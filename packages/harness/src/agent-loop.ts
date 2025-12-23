import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type {
  BetaRawMessageStreamEvent,
  BetaMessageParam,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { ZodObject } from "zod";
import { toJSONSchema } from "zod/v4/core";

/**
 * Zod-based tool definition (as exported by @august/shell-tools)
 */
export interface ZodToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodObject;
}

/**
 * Code execution tool definition
 */
const CODE_EXECUTION_TOOL = {
  type: "code_execution_20250825" as const,
  name: "code_execution" as const,
};

/**
 * Generate system prompt based on available tools and context
 */
function generateSystemPrompt(cwd?: string): string {
  let prompt = `You are a helpful assistant with access to various tools.`;

  if (cwd) {
    prompt += `\n\nCurrent working directory: ${cwd}`;
  }

  return prompt;
}

/**
 * Agent loop configuration
 */
export interface AgentLoopConfig {
  messages: BetaMessageParam[];
  tools?: (Tool | ZodToolDefinition)[];
  /**
   * Pre-converted MCP tools from McpConnection.tools.
   * When provided, code execution tool is automatically added and all tools
   * are marked as programmatically callable.
   */
  mcpTools?: Tool[];
  model?: string;
  maxTokens?: number;
  /** Optional Anthropic client instance. If not provided, a new client will be created. */
  client?: Anthropic;
  /** Optional container ID for code execution persistence */
  container?: string;
  /** Optional current working directory to include in the system prompt */
  cwd?: string;
}

/**
 * Run the agent loop as an async generator
 *
 * Takes messages and tools, streams them through the Anthropic API,
 * and yields events as they arrive.
 */
export async function* agentLoop(
  config: AgentLoopConfig
): AsyncGenerator<BetaRawMessageStreamEvent> {
  const {
    messages,
    tools = [],
    mcpTools = [],
    model = "claude-sonnet-4-5-20250929",
    maxTokens = 8192,
    client = new Anthropic(),
    container,
    cwd,
  } = config;

  // Enable programmatic tool calling when MCP tools are provided
  const useProgrammaticCalling = mcpTools.length > 0;

  // Convert local tools to Anthropic format (handle both Tool and ZodToolDefinition)
  const convertedTools: Tool[] = tools.map((tool) => {
    if ("input_schema" in tool) {
      // Already in Anthropic Tool format
      // Add allowed_callers if programmatic calling is enabled
      if (useProgrammaticCalling && !("allowed_callers" in tool)) {
        return {
          ...tool,
          allowed_callers: ["code_execution_20250825"],
        } as Tool;
      }
      return tool;
    }
    // ZodToolDefinition - convert inputSchema to JSON schema
    const converted: Tool = {
      name: tool.name,
      description: tool.description,
      input_schema: toJSONSchema(tool.inputSchema) as Tool["input_schema"],
    };
    // Add allowed_callers if programmatic calling is enabled
    if (useProgrammaticCalling) {
      (converted as Tool & { allowed_callers: string[] }).allowed_callers = [
        "code_execution_20250825",
      ];
    }
    return converted;
  });

  // Combine local tools with MCP tools (MCP tools already have allowed_callers set)
  let allTools: (Tool | typeof CODE_EXECUTION_TOOL)[] = [
    ...convertedTools,
    ...mcpTools,
  ];

  // Add code execution tool if using programmatic calling
  if (useProgrammaticCalling) {
    allTools = [CODE_EXECUTION_TOOL, ...allTools];
  }

  // Determine which betas to use
  const betas: string[] = [];
  if (useProgrammaticCalling) {
    betas.push("advanced-tool-use-2025-11-20");
  }

  // Generate dynamic system prompt based on available tools and context
  const systemPrompt = generateSystemPrompt(cwd);

  const stream = await client.beta.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    tools: allTools.length > 0 ? allTools : undefined,
    messages,
    betas: betas.length > 0 ? betas : undefined,
    container,
    stream: true,
  });

  for await (const event of stream) {
    yield event;
  }
}
