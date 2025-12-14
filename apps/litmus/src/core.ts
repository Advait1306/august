import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import type { BetaRequestMCPServerURLDefinition } from "@anthropic-ai/sdk/resources/beta/messages/messages";
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
import { agentLoop, type ZodToolDefinition } from "@august/harness";

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

/** MCP server definition for runAgentLoop */
export interface MCPServerDefinition {
  name: string;
  url: string;
  authToken?: string;
}

export interface RunAgentOptions {
  messages: MessageParam[];
  onText?: (text: string) => void;
  onToolStart?: (name: string) => void;
  onToolResult?: (name: string, result: string, isError: boolean) => void;
  maxIterations?: number;
  /** Optional Anthropic client instance for testing. If not provided, a new client will be created. */
  client?: Anthropic;
  /** Optional tool executors for testing. If not provided, uses default executors. */
  executors?: ToolExecutorMap;
  /** Optional MCP servers to connect to */
  mcpServers?: MCPServerDefinition[];
}

export async function runAgentLoop(options: RunAgentOptions): Promise<AgentResult> {
  const { messages, onText, onToolStart, onToolResult, maxIterations = 50, client, executors = toolExecutors, mcpServers = [] } = options;
  const toolCalls: ToolCall[] = [];
  let finalResponse = "";
  let iterations = 0;

  // Convert MCP server definitions to Anthropic format
  const mcpServerDefs: BetaRequestMCPServerURLDefinition[] = mcpServers.map((server) => ({
    type: "url" as const,
    name: server.name,
    url: server.url,
    authorization_token: server.authToken,
  }));

  while (iterations < maxIterations) {
    iterations++;
    const contentBlocks: Anthropic.ContentBlock[] = [];
    const partialJsonByIndex: Map<number, string> = new Map();
    let stopReason: string | null = null;

    for await (const event of agentLoop({ messages, tools, mcpServers: mcpServerDefs, client })) {
      if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block.type === "text") {
          contentBlocks.push({ ...block, text: "" });
        } else if (block.type === "tool_use") {
          // Client-side tool use - needs input parsing
          contentBlocks.push({ ...block, input: {} });
          partialJsonByIndex.set(event.index, "");
        } else if (block.type === "server_tool_use") {
          // Server-side tool use (e.g., web search) - needs input parsing
          contentBlocks.push({ ...block, input: {} } as Anthropic.ContentBlock);
          partialJsonByIndex.set(event.index, "");
        } else {
          // Handle other block types (web_search_tool_result, mcp_tool_use, mcp_tool_result, etc.)
          // These are passed through as-is since they don't require client-side processing
          contentBlocks.push(block as Anthropic.ContentBlock);
        }
      } else if (event.type === "content_block_delta") {
        const block = contentBlocks[event.index];
        if (!block) continue;

        if (event.delta.type === "text_delta" && block.type === "text") {
          onText?.(event.delta.text);
          (block as Anthropic.TextBlock).text += event.delta.text;
        } else if (event.delta.type === "input_json_delta") {
          // Handle input JSON delta for both tool_use and server_tool_use
          if (block.type === "tool_use" || block.type === "server_tool_use") {
            const current = partialJsonByIndex.get(event.index) ?? "";
            partialJsonByIndex.set(event.index, current + event.delta.partial_json);
          }
        }
      } else if (event.type === "content_block_stop") {
        const block = contentBlocks[event.index];
        // Parse JSON input for tool_use and server_tool_use blocks
        if (block?.type === "tool_use" || block?.type === "server_tool_use") {
          const jsonStr = partialJsonByIndex.get(event.index) ?? "{}";
          try {
            (block as { input: Record<string, unknown> }).input = JSON.parse(jsonStr);
          } catch {
            console.error(`Failed to parse tool input JSON: ${jsonStr}`);
            (block as { input: Record<string, unknown> }).input = {};
          }
        }
      } else if (event.type === "message_delta") {
        // Track the stop reason from the message delta
        stopReason = event.delta.stop_reason;
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

    // Handle stop reasons:
    // - pause_turn: Continue the loop (e.g., web search paused a long-running turn)
    // - tool_use: Execute client-side tools
    // - end_turn, max_tokens, etc.: Break out of the loop
    if (stopReason === "pause_turn") {
      // Server paused a long-running turn (e.g., during web search)
      // Continue the loop without adding a user message - the assistant message is already added
      continue;
    }

    // Check if we need to execute client-side tools
    const toolUseBlocks = contentBlocks.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      // No client-side tools to execute - we're done
      break;
    }

    // Execute client-side tools and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      onToolStart?.(toolUse.name);

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

    messages.push({ role: "user", content: toolResults });
  }

  if (iterations >= maxIterations) {
    throw new Error(`Agent loop exceeded maximum iterations (${maxIterations})`);
  }

  return { messages, toolCalls, finalResponse };
}
