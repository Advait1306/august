import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
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

export async function runAgentLoop(options: RunAgentOptions): Promise<AgentResult> {
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
  const mcpExecutor = mcpConnections.length > 0 ? createMcpExecutor(mcpConnections) : null;

  // Build set of MCP tool names for quick lookup
  const mcpToolNames = new Set(mcpTools.map((t) => t.name));

  // Track container ID for code execution persistence across programmatic tool calls
  let containerId: string | undefined;

  while (iterations < maxIterations) {
    iterations++;
    const contentBlocks: Anthropic.ContentBlock[] = [];
    const partialJsonByIndex: Map<number, string> = new Map();
    let stopReason: string | null = null;

    for await (const event of agentLoop({ messages, tools, mcpTools, client, container: containerId })) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventAny = event as any;

      // Handle message_start - may contain content blocks and container info
      if (event.type === "message_start") {
        const message = eventAny.message;
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
      // Handle message_delta - may contain container info
      if (event.type === "message_delta") {
        if (eventAny.delta?.container?.id) {
          containerId = eventAny.delta.container.id;
        }
        stopReason = event.delta.stop_reason;
        continue;
      }
      if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block.type === "text") {
          contentBlocks.push({ ...block, text: "" });
        } else if (block.type === "tool_use") {
          // Tool use (local or MCP) - needs input parsing
          // For programmatic tool calls, input may already be populated
          const toolBlock = block as { id: string; name: string; input?: unknown };
          if (toolBlock.input && Object.keys(toolBlock.input as object).length > 0) {
            // Input already populated (programmatic call) - use it directly
            contentBlocks.push({ ...block } as Anthropic.ContentBlock);
          } else {
            // Need to collect input from input_json_delta events
            contentBlocks.push({ ...block, input: {} });
            partialJsonByIndex.set(event.index, "");
          }
        } else if (block.type === "server_tool_use") {
          // Server-side tool use (e.g., code execution) - needs input parsing
          contentBlocks.push({ ...block, input: {} } as Anthropic.ContentBlock);
          partialJsonByIndex.set(event.index, "");
        } else {
          // Handle other block types (code_execution_tool_result, etc.)
          contentBlocks.push(block as Anthropic.ContentBlock);
        }
      } else if (event.type === "content_block_delta") {
        const block = contentBlocks[event.index];
        if (!block) continue;

        if (event.delta.type === "text_delta" && block.type === "text") {
          onText?.(event.delta.text);
          (block as Anthropic.TextBlock).text += event.delta.text;
        } else if (event.delta.type === "input_json_delta") {
          const blockType = (block as { type: string }).type;
          if (blockType === "tool_use" || blockType === "server_tool_use") {
            const current = partialJsonByIndex.get(event.index) ?? "";
            partialJsonByIndex.set(event.index, current + event.delta.partial_json);
          }
        }
      } else if (event.type === "content_block_stop") {
        const block = contentBlocks[event.index];
        const blockType = (block as { type: string } | undefined)?.type;
        if (blockType === "tool_use" || blockType === "server_tool_use") {
          // Only parse JSON if we were collecting input_json_delta events
          if (partialJsonByIndex.has(event.index)) {
            const jsonStr = partialJsonByIndex.get(event.index) ?? "{}";
            try {
              (block as { input: Record<string, unknown> }).input = JSON.parse(jsonStr || "{}");
            } catch {
              (block as { input: Record<string, unknown> }).input = {};
            }
          }
        }
      }
    }

    messages.push({ role: "assistant", content: contentBlocks });

    // Extract final text response
    const textBlocks = contentBlocks.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    if (textBlocks.length > 0) {
      finalResponse = textBlocks.map((b) => b.text).join("\n");
    }

    // Handle stop reasons
    if (stopReason === "pause_turn") {
      continue;
    }

    // Check if we need to execute tools
    const toolUseBlocks = contentBlocks.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      break;
    }

    // Execute tools and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      // Check if this is an MCP tool (prefixed with serverName__)
      const isMcpTool = mcpToolNames.has(toolUse.name);

      onToolStart?.(toolUse.name, toolUse.input);

      if (isMcpTool && mcpExecutor) {
        // Execute MCP tool
        try {
          const result = await mcpExecutor(toolUse.name, toolUse.input as Record<string, unknown>);
          const resultStr = typeof result === "string" ? result : JSON.stringify(result, null, 2);
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
          const errorMsg = error instanceof Error ? error.message : String(error);
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
      } else {
        // Execute local tool
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
          const resultStr = typeof result === "string" ? result : JSON.stringify(result, null, 2);
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
          const errorMsg = error instanceof Error ? error.message : String(error);
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

    messages.push({ role: "user", content: toolResults });
  }

  if (iterations >= maxIterations) {
    throw new Error(`Agent loop exceeded maximum iterations (${maxIterations})`);
  }

  return { messages, toolCalls, finalResponse };
}
