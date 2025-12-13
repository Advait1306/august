import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import {
  ls,
  lsToolDefinition,
  glob,
  globToolDefinition,
  grep,
  grepToolDefinition,
  edit,
  editToolDefinition,
  multiedit,
  multieditToolDefinition,
  write,
  writeToolDefinition,
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

// Map tool names to their implementations
export const toolExecutors: Record<string, (input: unknown) => Promise<unknown>> = {
  ls: (input) => ls(input as Parameters<typeof ls>[0]),
  glob: (input) => glob(input as Parameters<typeof glob>[0]),
  grep: (input) => grep(input as Parameters<typeof grep>[0]),
  edit: (input) => edit(input as Parameters<typeof edit>[0]),
  multiedit: (input) => multiedit(input as Parameters<typeof multiedit>[0]),
  write: (input) => write(input as Parameters<typeof write>[0]),
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
  onToolStart?: (name: string) => void;
  onToolResult?: (name: string, result: string, isError: boolean) => void;
}

export async function runAgentLoop(options: RunAgentOptions): Promise<AgentResult> {
  const { messages, onText, onToolStart, onToolResult } = options;
  const toolCalls: ToolCall[] = [];
  let finalResponse = "";

  while (true) {
    const contentBlocks: Anthropic.ContentBlock[] = [];
    const partialJsonByIndex: Map<number, string> = new Map();

    for await (const event of agentLoop({ messages, tools })) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "text") {
          contentBlocks.push({ ...event.content_block, text: "" });
        } else if (event.content_block.type === "tool_use") {
          contentBlocks.push({ ...event.content_block, input: {} });
          partialJsonByIndex.set(event.index, "");
        }
      } else if (event.type === "content_block_delta") {
        const block = contentBlocks[event.index];
        if (event.delta.type === "text_delta" && block?.type === "text") {
          onText?.(event.delta.text);
          block.text += event.delta.text;
        } else if (event.delta.type === "input_json_delta" && block?.type === "tool_use") {
          const current = partialJsonByIndex.get(event.index) ?? "";
          partialJsonByIndex.set(event.index, current + event.delta.partial_json);
        }
      } else if (event.type === "content_block_stop") {
        const block = contentBlocks[event.index];
        if (block?.type === "tool_use") {
          const jsonStr = partialJsonByIndex.get(event.index) ?? "{}";
          (block as { input: Record<string, unknown> }).input = JSON.parse(jsonStr);
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
      onToolStart?.(toolUse.name);

      const executor = toolExecutors[toolUse.name];
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

  return { messages, toolCalls, finalResponse };
}
