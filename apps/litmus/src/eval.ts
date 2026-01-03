import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { runAgentLoop } from "./core.js";

function parseArgs(): { task: string } {
  const args = process.argv.slice(2);
  let task = "";

  for (let i = 0; i < args.length; i++) {
    const nextArg = args[i + 1];
    if (args[i] === "--task" && nextArg) {
      task = nextArg;
      i++;
    }
  }

  if (!task) {
    console.error("Usage: npm run eval -- --task \"Your task here\"");
    process.exit(1);
  }

  return { task };
}

async function main() {
  const { task } = parseArgs();
  const messages: MessageParam[] = [{ role: "user", content: task }];

  console.log(`Task: ${task}\n`);

  const result = await runAgentLoop({
    messages,
    onText: (text) => process.stdout.write(text),
    onToolStart: (name) => console.log(`\n[Tool: ${name}]`),
    onToolResult: (_name, result, isError) => {
      const preview = result.slice(0, 500) + (result.length > 500 ? "..." : "");
      console.log(isError ? `Error: ${preview}` : preview);
    },
  });

  console.log(`\n\n---\nMessages: ${result.messages.length}, Tools: ${result.toolCalls.length}`);
}

main().catch((error) => {
  console.error(`Error: ${error}`);
  process.exit(1);
});
