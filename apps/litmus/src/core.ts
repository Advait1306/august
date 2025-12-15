import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import type {
  BetaRawMessageStartEvent,
  BetaRawMessageDeltaEvent,
  BetaToolUseBlock,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import {
  ls,
  lsToolDefinition,
  LsInputSchema,
  glob,
  globToolDefinition,
  GlobInputSchema,
  grep,
  grepToolDefinition,
  GrepInputSchema,
  edit,
  editToolDefinition,
  EditInputSchema,
  multiedit,
  multieditToolDefinition,
  MultiEditInputSchema,
  write,
  writeToolDefinition,
  WriteInputSchema,
} from "@august/shell-tools";
import {
  agentLoop,
  type ZodToolDefinition,
  type McpConnection,
  getMcpTools,
  createMcpExecutor,
} from "@august/harness";

// All available tools
export const tools: ZodToolDefinition[] = [
  lsToolDefinition,
  globToolDefinition,
  grepToolDefinition,
  editToolDefinition,
  multieditToolDefinition,
  writeToolDefinition,
];

/** Tool executor function type */
export type ToolExecutor = (input: unknown) => Promise<unknown>;

/** Map of tool names to their executor functions */
export type ToolExecutorMap = Record<string, ToolExecutor>;

// Map tool names to their implementations with runtime validation
export const toolExecutors: ToolExecutorMap = {
  ls: async (input) => {
    const parsed = LsInputSchema.parse(input);
    return ls(parsed);
  },
  glob: async (input) => {
    const parsed = GlobInputSchema.parse(input);
    return glob(parsed);
  },
  grep: async (input) => {
    const parsed = GrepInputSchema.parse(input);
    return grep(parsed);
  },
  edit: async (input) => {
    const parsed = EditInputSchema.parse(input);
    return edit(parsed);
  },
  multiedit: async (input) => {
    const parsed = MultiEditInputSchema.parse(input);
    return multiedit(parsed);
  },
  write: async (input) => {
    const parsed = WriteInputSchema.parse(input);
    return write(parsed);
  },
};

export interface ToolCall {
  name: string;
  input: unknown;
  result: string;
  isError: boolean;
}

export interface AgentResult {
  messages: MessageParam[];
  toolCalls: ToolCall[];
  finalResponse: string;
}

export interface RunAgentOptions {
  messages: MessageParam[];
  onText?: (text: string) => void;
  onToolStart?: (name: string, input: unknown) => void;
  onToolResult?: (name: string, result: string, isError: boolean) => void;
  maxIterations?: number;
  /** Optional Anthropic client instance for testing. If not provided, a new client will be created. */
  client?: Anthropic;
  /** Optional tool executors for testing. If not provided, uses default executors. */
  executors?: ToolExecutorMap;
  /**
   * Pre-connected MCP connections for programmatic tool calling.
   * Use connectMcpServers() from @august/harness to create these.
   */
  mcpConnections?: McpConnection[];
}

export async function runAgentLoop(
  options: RunAgentOptions
): Promise<AgentResult> {
  const {
    messages,
    onText,
    onToolStart,
    onToolResult,
    maxIterations = 50,
    client,
    executors = toolExecutors,
    mcpConnections = [],
  } = options;

  const toolCalls: ToolCall[] = [];
  let finalResponse = "";
  let iterations = 0;

  // Get MCP tools from connections (already have allowed_callers set)
  const mcpTools = getMcpTools(mcpConnections);

  // Create unified MCP executor for all connections
  const mcpExecutor =
    mcpConnections.length > 0 ? createMcpExecutor(mcpConnections) : null;

  // Build set of MCP tool names for quick lookup
  const mcpToolNames = new Set(mcpTools.map((t) => t.name));

  // Track container ID for code execution persistence across programmatic tool calls
  let containerId: string | undefined;

  // Main agent loop - continues until:
  // 1. No more tool calls (model finished responding)
  // 2. Max iterations reached
  // 3. Error occurs
  while (iterations < maxIterations) {
    iterations++;
    const contentBlocks: Anthropic.ContentBlock[] = [];
    // Track partial JSON for tool inputs that arrive incrementally via input_json_delta events
    const partialJsonByIndex: Map<number, string> = new Map();
    let stopReason: string | null = null;

    // Stream events from a single API call to the model
    for await (const event of agentLoop({
      messages,
      tools,
      mcpTools,
      client,
      container: containerId,
    })) {
      // EVENT TYPE: message_start
      // First event in the stream - contains message metadata and possibly pre-populated content
      if (event.type === "message_start") {
        const { message } = event as BetaRawMessageStartEvent;
        if (message.container?.id) {
          containerId = message.container.id;
        }
        if (message.content && Array.isArray(message.content)) {
          for (const block of message.content) {
            contentBlocks.push(block as Anthropic.ContentBlock);
          }
        }
        if (message.stop_reason) {
          stopReason = message.stop_reason;
        }
        continue;
      }
      // EVENT TYPE: message_delta
      // Final event before message_stop - contains stop_reason and final metadata
      if (event.type === "message_delta") {
        const { delta } = event as BetaRawMessageDeltaEvent;
        if (delta.container?.id) {
          containerId = delta.container.id;
        }
        stopReason = delta.stop_reason;
        continue;
      }
      // EVENT TYPE: content_block_start
      // Signals the beginning of a new content block (text, tool_use, server_tool_use, etc.)
      // We initialize the block here and may need to accumulate data in subsequent delta events
      if (event.type === "content_block_start") {
        const block = event.content_block;

        // BLOCK TYPE: text - model's text response
        if (block.type === "text") {
          contentBlocks.push({ ...block, text: "" });

        // BLOCK TYPE: tool_use - local or MCP tool call
        } else if (block.type === "tool_use") {
          const toolBlock = block as BetaToolUseBlock;
          // Check if input is already populated (happens with programmatic/pre-computed tool calls)
          if (
            toolBlock.input &&
            Object.keys(toolBlock.input as object).length > 0
          ) {
            // Input already complete - no need to collect from delta events
            contentBlocks.push({ ...block } as Anthropic.ContentBlock);
          } else {
            // Input will arrive incrementally via input_json_delta events
            contentBlocks.push({ ...block, input: {} });
            partialJsonByIndex.set(event.index, "");
          }

        // BLOCK TYPE: server_tool_use - server-side tool (e.g., code execution sandbox)
        } else if (block.type === "server_tool_use") {
          // Server tools always need input parsing from delta events
          contentBlocks.push({ ...block, input: {} } as Anthropic.ContentBlock);
          partialJsonByIndex.set(event.index, "");

        // BLOCK TYPE: other - code_execution_tool_result, mcp_tool_result, etc.
        } else {
          // These blocks come pre-populated, just store them
          contentBlocks.push(block as Anthropic.ContentBlock);
        }
      // EVENT TYPE: content_block_delta
      // Incremental updates to a content block - either text chunks or JSON fragments
      } else if (event.type === "content_block_delta") {
        const block = contentBlocks[event.index];
        if (!block) continue;

        // DELTA TYPE: text_delta - append text to a text block
        if (event.delta.type === "text_delta" && block.type === "text") {
          onText?.(event.delta.text);
          (block as Anthropic.TextBlock).text += event.delta.text;

        // DELTA TYPE: input_json_delta - accumulate JSON for tool input
        } else if (event.delta.type === "input_json_delta") {
          const blockType = block.type;
          if (blockType === "tool_use" || blockType === "server_tool_use") {
            // Concatenate JSON fragments - will be parsed in content_block_stop
            const current = partialJsonByIndex.get(event.index) ?? "";
            partialJsonByIndex.set(
              event.index,
              current + event.delta.partial_json
            );
          }
        }

      // EVENT TYPE: content_block_stop
      // Block is complete - finalize any accumulated data
      } else if (event.type === "content_block_stop") {
        const block = contentBlocks[event.index];
        const blockType = (block as { type: string } | undefined)?.type;
        if (blockType === "tool_use" || blockType === "server_tool_use") {
          // Parse accumulated JSON into the block's input field
          // Only if we were collecting fragments (not for pre-populated inputs)
          if (partialJsonByIndex.has(event.index)) {
            const jsonStr = partialJsonByIndex.get(event.index) ?? "{}";
            try {
              (block as { input: Record<string, unknown> }).input = JSON.parse(
                jsonStr || "{}"
              );
            } catch {
              (block as { input: Record<string, unknown> }).input = {};
            }
          }
        }
      }
    }
    // End of streaming for this API call

    // Add assistant's response to conversation history
    messages.push({ role: "assistant", content: contentBlocks });

    // Extract final text response for return value
    const textBlocks = contentBlocks.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    if (textBlocks.length > 0) {
      finalResponse = textBlocks.map((b) => b.text).join("\n");
    }

    // STOP REASON: pause_turn
    // Server-side tools (code execution) are still running - continue to next iteration
    // to get the results without executing any local tools
    if (stopReason === "pause_turn") {
      continue;
    }

    // Check if we need to execute local/MCP tools
    const toolUseBlocks = contentBlocks.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    // STOP REASON: end_turn or max_tokens (no tool_use blocks)
    // Model finished responding without requesting tools - exit the loop
    if (toolUseBlocks.length === 0) {
      break;
    }

    // STOP REASON: tool_use
    // Model requested tool calls - execute them and continue the loop
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      // Determine if this tool is served by an MCP connection
      // MCP tools are prefixed with serverName__ (e.g., "filesystem__readFile")
      const isMcpTool = mcpToolNames.has(toolUse.name);

      onToolStart?.(toolUse.name, toolUse.input);

      // BRANCH: MCP tool execution
      // Route to the appropriate MCP server via the unified executor
      if (isMcpTool && mcpExecutor) {
        try {
          const result = await mcpExecutor(
            toolUse.name,
            toolUse.input as Record<string, unknown>
          );
          const resultStr =
            typeof result === "string"
              ? result
              : JSON.stringify(result, null, 2);
          toolCalls.push({
            name: toolUse.name,
            input: toolUse.input,
            result: resultStr,
            isError: false,
          });
          onToolResult?.(toolUse.name, resultStr, false);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: resultStr,
          });
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          toolCalls.push({
            name: toolUse.name,
            input: toolUse.input,
            result: errorMsg,
            isError: true,
          });
          onToolResult?.(toolUse.name, errorMsg, true);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: errorMsg,
            is_error: true,
          });
        }

      // BRANCH: Local tool execution
      // Use the toolExecutors map to find and run the tool
      } else {
        const executor = executors[toolUse.name];
        if (!executor) {
          const errorMsg = `Unknown tool: ${toolUse.name}`;
          toolCalls.push({
            name: toolUse.name,
            input: toolUse.input,
            result: errorMsg,
            isError: true,
          });
          onToolResult?.(toolUse.name, errorMsg, true);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: errorMsg,
            is_error: true,
          });
          continue;
        }

        try {
          const result = await executor(toolUse.input);
          const resultStr =
            typeof result === "string"
              ? result
              : JSON.stringify(result, null, 2);
          toolCalls.push({
            name: toolUse.name,
            input: toolUse.input,
            result: resultStr,
            isError: false,
          });
          onToolResult?.(toolUse.name, resultStr, false);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: resultStr,
          });
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          toolCalls.push({
            name: toolUse.name,
            input: toolUse.input,
            result: errorMsg,
            isError: true,
          });
          onToolResult?.(toolUse.name, errorMsg, true);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: errorMsg,
            is_error: true,
          });
        }
      }
    }

    // Add tool results to conversation as a "user" message
    // This lets the model see the results and continue reasoning
    messages.push({ role: "user", content: toolResults });
    // Loop continues - model will process tool results and respond
  }

  // Safety check: prevent infinite loops
  if (iterations >= maxIterations) {
    throw new Error(
      `Agent loop exceeded maximum iterations (${maxIterations})`
    );
  }

  return { messages, toolCalls, finalResponse };
}
