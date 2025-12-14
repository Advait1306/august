import * as readline from "readline";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { runAgentLoop } from "./core.js";

const messages: MessageParam[] = [];

async function handleUserMessage(userMessage: string): Promise<void> {
  messages.push({ role: "user", content: userMessage });

  process.stdout.write("\n\x1b[34mAssistant:\x1b[0m ");

  await runAgentLoop({
    messages,
    onText: (text) => process.stdout.write(text),
    onToolStart: (name) => console.log(`\n\x1b[33m[Tool: ${name}]\x1b[0m`),
    onToolResult: (name, result, isError) => {
      if (isError) {
        console.log(`\x1b[31mError: ${result}\x1b[0m`);
      } else {
        console.log(`\x1b[90m${result.slice(0, 500)}${result.length > 500 ? "..." : ""}\x1b[0m`);
      }
    },
  });
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

      console.log(`\x1b[90m> ${trimmed}\x1b[0m`);
      process.stdout.write("\x1b[33mProcessing...\x1b[0m");

      try {
        process.stdout.write("\r\x1b[K");
        await handleUserMessage(trimmed);
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
