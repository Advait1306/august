import "dotenv/config";
import * as readline from "readline";
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
const tools: ZodToolDefinition[] = [
  lsToolDefinition,
  globToolDefinition,
  grepToolDefinition,
  editToolDefinition,
  multieditToolDefinition,
  writeToolDefinition,
];

// Map tool names to their implementations
const toolExecutors: Record<string, (input: unknown) => Promise<unknown>> = {
  ls: (input) => ls(input as Parameters<typeof ls>[0]),
  glob: (input) => glob(input as Parameters<typeof glob>[0]),
  grep: (input) => grep(input as Parameters<typeof grep>[0]),
  edit: (input) => edit(input as Parameters<typeof edit>[0]),
  multiedit: (input) => multiedit(input as Parameters<typeof multiedit>[0]),
  write: (input) => write(input as Parameters<typeof write>[0]),
};

const messages: MessageParam[] = [];

async function runAgentLoop(userMessage: string): Promise<void> {
  messages.push({ role: "user", content: userMessage });

  while (true) {
    process.stdout.write("\n\x1b[34mAssistant:\x1b[0m ");

    const contentBlocks: Anthropic.ContentBlock[] = [];
    // Accumulate partial JSON strings for tool_use blocks (keyed by index)
    const partialJsonByIndex: Map<number, string> = new Map();

    // Stream the response
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
          process.stdout.write(event.delta.text);
          block.text += event.delta.text;
        } else if (event.delta.type === "input_json_delta" && block?.type === "tool_use") {
          // Accumulate partial JSON string - don't parse yet
          const current = partialJsonByIndex.get(event.index) ?? "";
          partialJsonByIndex.set(event.index, current + event.delta.partial_json);
        }
      } else if (event.type === "content_block_stop") {
        // Parse accumulated JSON when block is complete
        const block = contentBlocks[event.index];
        if (block?.type === "tool_use") {
          const jsonStr = partialJsonByIndex.get(event.index) ?? "{}";
          (block as { input: Record<string, unknown> }).input = JSON.parse(jsonStr);
        }
      }
    }

    messages.push({ role: "assistant", content: contentBlocks });

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
      console.log(`\n\x1b[33m[Tool: ${toolUse.name}]\x1b[0m`);

      const executor = toolExecutors[toolUse.name];
      if (!executor) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: `Unknown tool: ${toolUse.name}`,
          is_error: true,
        });
        continue;
      }

      try {
        const result = await executor(toolUse.input);
        const resultStr = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        console.log(`\x1b[90m${resultStr.slice(0, 500)}${resultStr.length > 500 ? "..." : ""}\x1b[0m`);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: resultStr,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`\x1b[31mError: ${errorMsg}\x1b[0m`);
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
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  console.log("\x1b[36mLitmus Agent\x1b[0m");
  console.log("Type your message and press Enter. Type 'exit' to quit.\n");

  const prompt = () => {
    process.stdout.write("\x1b[32mYou:\x1b[0m ");
    rl.question("", async (input) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === "exit") {
        console.log("Goodbye!");
        rl.close();
        return;
      }

      if (!trimmed) {
        prompt();
        return;
      }

      // Echo the input and show processing indicator
      console.log(`\x1b[90m> ${trimmed}\x1b[0m`);
      process.stdout.write("\x1b[33mProcessing...\x1b[0m");

      try {
        // Clear the "Processing..." text before showing response
        process.stdout.write("\r\x1b[K");
        await runAgentLoop(trimmed);
      } catch (error) {
        process.stdout.write("\r\x1b[K");
        console.error("\x1b[31mError:\x1b[0m", error);
      }

      console.log();
      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
