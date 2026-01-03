import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type {
  BetaRawMessageStreamEvent,
  BetaMessageParam,
  BetaTextBlockParam,
  BetaCacheControlEphemeral,
  BetaContentBlockParam,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { ZodObject } from "zod";
import { toJSONSchema } from "zod/v4/core";
import { BASE_PROMPT } from "./base-prompt";

/**
 * Zod-based tool definition (as exported by @august/shell-tools)
 */
export interface ZodToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodObject;
}

/**
 * Default model for the agent loop
 */
export const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

/**
 * Code execution tool definition
 */
const CODE_EXECUTION_TOOL = {
  type: "code_execution_20250825" as const,
  name: "code_execution" as const,
};

/**
 * Skill definition for system prompt injection
 */
export interface SkillSummary {
  id: string;
  name: string;
  description: string | null;
}

/**
 * Cache control constant for prompt caching
 */
const CACHE_CONTROL: BetaCacheControlEphemeral = { type: "ephemeral" };

/**
 * Build a set of tool_use_ids that were called by code execution.
 * Tool results for these cannot have cache_control.
 */
function getCodeExecutionToolUseIds(messages: BetaMessageParam[]): Set<string> {
  const codeExecutionIds = new Set<string>();

  for (const message of messages) {
    if (typeof message.content === "string") continue;
    if (!Array.isArray(message.content)) continue;

    for (const block of message.content) {
      // Check for tool_use blocks with code_execution caller
      if (
        block.type === "tool_use" &&
        "caller" in block &&
        block.caller?.type === "code_execution_20250825"
      ) {
        codeExecutionIds.add(block.id);
      }
    }
  }

  return codeExecutionIds;
}

/**
 * Check if a content block can have cache_control added.
 * Tool use blocks and tool results called by code execution cannot have cache_control.
 */
function canHaveCacheControl(
  block: BetaContentBlockParam,
  codeExecutionToolUseIds: Set<string>
): boolean {
  // Tool use blocks called by code execution cannot have cache_control
  if (
    block.type === "tool_use" &&
    "caller" in block &&
    (block as { caller?: { type: string } }).caller?.type ===
      "code_execution_20250825"
  ) {
    return false;
  }
  // Tool results for code execution tool calls cannot have cache_control
  if (block.type === "tool_result" && "tool_use_id" in block) {
    return !codeExecutionToolUseIds.has(block.tool_use_id);
  }
  return true;
}

/**
 * Add cache_control to the last eligible content block.
 * This enables incremental caching of conversation history.
 * Tool results called by code execution are skipped as they cannot have cache_control.
 */
function addMessageCacheControl(
  messages: BetaMessageParam[]
): BetaMessageParam[] {
  if (messages.length === 0) return messages;

  // Build set of tool_use_ids called by code execution
  const codeExecutionToolUseIds = getCodeExecutionToolUseIds(messages);

  const result = [...messages];

  // Walk backwards through messages to find an eligible block for cache_control
  for (let msgIdx = result.length - 1; msgIdx >= 0; msgIdx--) {
    const message = result[msgIdx]!;

    // Handle string content - convert to text block with cache_control
    if (typeof message.content === "string") {
      result[msgIdx] = {
        role: message.role,
        content: [
          {
            type: "text",
            text: message.content,
            cache_control: CACHE_CONTROL,
          },
        ],
      };
      return result;
    }

    // Handle array content - find last eligible block
    if (Array.isArray(message.content) && message.content.length > 0) {
      const contentBlocks = [...message.content];

      // Walk backwards through blocks to find one that can have cache_control
      for (let blockIdx = contentBlocks.length - 1; blockIdx >= 0; blockIdx--) {
        const block = contentBlocks[blockIdx]!;

        if (canHaveCacheControl(block, codeExecutionToolUseIds)) {
          contentBlocks[blockIdx] = {
            ...block,
            cache_control: CACHE_CONTROL,
          } as BetaContentBlockParam;

          result[msgIdx] = {
            role: message.role,
            content: contentBlocks,
          };
          return result;
        }
      }
    }
  }

  // No eligible block found, return original messages
  return messages;
}

/**
 * Generate system prompt blocks with cache control for prompt caching.
 * Returns an array of text blocks:
 * - Block 1: BASE_PROMPT (cached) - static instructions
 * - Block 2: Skills + CWD (cached) - dynamic but stable per-task
 */
function generateSystemPrompt(
  cwd?: string,
  skills?: SkillSummary[]
): BetaTextBlockParam[] {
  const blocks: BetaTextBlockParam[] = [
    {
      type: "text",
      text: BASE_PROMPT,
      cache_control: CACHE_CONTROL,
    },
  ];

  // Build dynamic content (skills + cwd)
  let dynamicContent = "";

  if (skills && skills.length > 0) {
    dynamicContent += `## Available Skills\n`;
    dynamicContent += `The following skills are available for this task. Use the \`get_skill\` tool to retrieve the full skill prompt and discover its supporting documents. Use the \`get_document\` tool to retrieve specific document contents.\n`;
    for (const skill of skills) {
      dynamicContent += `\n### ${skill.name} (ID: ${skill.id})`;
      if (skill.description) {
        dynamicContent += `\n${skill.description}`;
      }
    }
  }

  if (cwd) {
    dynamicContent += `${dynamicContent ? "\n\n" : ""}Current working directory: ${cwd}`;
  }

  // Add dynamic content as a separate cached block if present
  if (dynamicContent) {
    blocks.push({
      type: "text",
      text: dynamicContent,
      cache_control: CACHE_CONTROL,
    });
  }

  return blocks;
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
  /** Optional skills available for this task, injected into system prompt */
  skills?: SkillSummary[];
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
    model = DEFAULT_MODEL,
    maxTokens = 8192,
    client = new Anthropic(),
    container,
    cwd,
    skills,
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
  // Add cache_control to the last tool for prompt caching
  const combinedTools: Tool[] = [...convertedTools, ...mcpTools];
  const allToolsWithCache: Tool[] =
    combinedTools.length > 0
      ? [
          ...combinedTools.slice(0, -1),
          {
            ...combinedTools[combinedTools.length - 1],
            cache_control: CACHE_CONTROL,
          } as Tool,
        ]
      : [];

  // Add code execution tool at the beginning if using programmatic calling
  const allTools: (Tool | typeof CODE_EXECUTION_TOOL)[] = useProgrammaticCalling
    ? [CODE_EXECUTION_TOOL, ...allToolsWithCache]
    : allToolsWithCache;

  // Determine which betas to use
  const betas: string[] = [];
  if (useProgrammaticCalling) {
    betas.push("advanced-tool-use-2025-11-20");
  }

  // Generate dynamic system prompt based on available tools, context, and skills
  const systemPrompt = generateSystemPrompt(cwd, skills);

  // Add cache_control to messages for incremental conversation caching
  const cachedMessages = addMessageCacheControl(messages);

  const stream = await client.beta.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    tools: allTools.length > 0 ? allTools : undefined,
    messages: cachedMessages,
    betas: betas.length > 0 ? betas : undefined,
    container,
    stream: true,
  });

  for await (const event of stream) {
    yield event;
  }
}
