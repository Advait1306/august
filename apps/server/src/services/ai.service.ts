import { asc, eq, InferSelectModel } from "drizzle-orm";
import { AppState } from "../config/state";
import { blocks, tasks, turns } from "@jupiter/sync/db/schema";
import {
  agentLoop,
  McpConnection,
  getMcpTools,
  DEFAULT_MODEL,
} from "@august/harness";
import { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AssistantTurnProcessor } from "../processors/assistant-turn-processor";
import { toolDefinitions } from "@august/shell-tools";
import { serverToolDefinitions } from "../server-tools";
import {
  ToolResultBlockParam,
  ToolUseBlockParam,
} from "@anthropic-ai/sdk/resources";
import { McpService } from "./mcp.service";

// const MAX_ITERATIONS = 50;

type TaskWithTurns = InferSelectModel<typeof tasks> & {
  turns: (InferSelectModel<typeof turns> & {
    blocks: InferSelectModel<typeof blocks>[];
  })[];
};

interface ProcessBlockParams {
  task: TaskWithTurns;
  turn: InferSelectModel<typeof turns>;
  block: InferSelectModel<typeof blocks>;
}

export class AiService {
  private static instance: AiService;
  private mcpService: McpService;

  private constructor(private db: AppState["db"]) {
    this.mcpService = new McpService(db);
  }

  public static getInstance(state: AppState) {
    if (!AiService.instance) {
      AiService.instance = new AiService(state.db);
    }
    return AiService.instance;
  }

  async processBlock(taskId: string, turnId: string, blockId: string) {
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: {
        turns: {
          with: {
            blocks: {
              where: eq(blocks.processed, true),
              orderBy: [asc(blocks.created_at)],
            },
          },
          orderBy: [asc(turns.created_at)],
        },
      },
    });

    if (!task) {
      throw new Error("Task not found");
    }

    // TODO: can potentially just pass the turnId instead of fetch the turn from db
    const turn = await this.db.query.turns.findFirst({
      where: eq(turns.id, turnId),
    });

    if (!turn) {
      throw new Error("Turn not found");
    }

    const block = await this.db.query.blocks.findFirst({
      where: eq(blocks.id, blockId),
    });

    if (!block) {
      throw new Error("Block not found");
    }

    if (block.processed) {
      throw new Error("Block has already been processed");
    }

    if (block.type === "tool_result") {
      return this.processToolResultBlock({ task, turn, block });
    } else if (block.type === "text") {
      return this.processTextBlock({ task, turn, block });
    }
  }

  private async processToolResultBlock(params: ProcessBlockParams) {
    const { task, turn, block } = params;

    if (turn.type !== "user") {
      throw new Error("Only user turns can trigger agent loop");
    }

    // Get last turn that should contain the corresponding tool_use
    const lastAssistantTurnToolUseBlocks = task.turns
      .slice()
      .reverse()
      .find((turn) => turn.type === "assistant")
      ?.blocks.filter((block) => block.type === "tool_use");

    if (
      !lastAssistantTurnToolUseBlocks ||
      lastAssistantTurnToolUseBlocks.length === 0
    ) {
      throw new Error("No tool use blocks found to associate tool result");
    }

    // Match tool_use_id from tool_result to tool_use
    const toolUseId = (block.content as ToolResultBlockParam).tool_use_id;

    const toolUseBlock = lastAssistantTurnToolUseBlocks.find(
      (block) => (block.content as ToolUseBlockParam).id === toolUseId
    );

    if (!toolUseBlock) {
      throw new Error("Tool use block not found to associate tool result");
    }

    // tool_result block matched with tool_use block, mark it as processed
    await this.db
      .update(blocks)
      .set({
        processed: true,
      })
      .where(eq(blocks.id, block.id));

    // Check if all tool_use blocks are answered - to start the agent loop
    const toolResultBlocks = task.turns
      .find((t) => t.id === turn.id)
      ?.blocks.filter((block) => block.type === "tool_result");

    if (!toolResultBlocks) {
      throw new Error("Tool result blocks not found");
    }

    const appendedToolResultBlocks = [...toolResultBlocks, block];

    // TODO: Find a better array matching algorithm, this is O(n^2)
    if (
      lastAssistantTurnToolUseBlocks.every((block) => {
        const tool_use_id = (block.content as ToolUseBlockParam).id;

        return appendedToolResultBlocks.some((toolResultBlock) => {
          const result_tool_use_id = (
            toolResultBlock.content as ToolResultBlockParam
          ).tool_use_id;
          return result_tool_use_id === tool_use_id;
        });
      })
    ) {
      // All tool use blocks are answered, start the agent loop
      await this.runAgentLoop(params.task.id);
    }
  }

  private async processTextBlock(params: ProcessBlockParams) {
    // TODO: We might have to check for integrity here

    await this.db
      .update(blocks)
      .set({
        processed: true,
      })
      .where(eq(blocks.id, params.block.id));

    // Start agent loop
    await this.runAgentLoop(params.task.id);
  }

  private async runAgentLoop(taskId: string) {
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: {
        turns: {
          with: {
            blocks: {
              where: eq(blocks.processed, true),
              orderBy: [asc(blocks.created_at)],
            },
          },
          orderBy: [asc(turns.created_at)],
        },
        runtime: true,
        taskSkills: {
          with: {
            skill: true,
          },
        },
      },
    });

    if (!task) {
      throw new Error("Task not found");
    }

    // Get tools from runtime and map to tool definitions
    // TODO: Check version numbers here to verify correct tools are being used
    const runtimeTools = task.runtime?.tools ?? [];
    const shellTools = toolDefinitions.filter((toolDef) =>
      runtimeTools.some((rt) => rt.name === toolDef.name)
    );

    // Server tools are always available
    const tools = [...shellTools, ...serverToolDefinitions];

    // Connect to user's MCP servers and get their tools
    let mcpConnections: McpConnection[] = [];
    let mcpTools: ReturnType<typeof getMcpTools> = [];
    let toolToMcpId = new Map<string, string>();

    try {
      const mcpResult = await this.mcpService.connectUserMcps(task.author_id);
      mcpConnections = mcpResult.connections;
      mcpTools = mcpResult.tools;
      toolToMcpId = mcpResult.toolToMcpId;
    } catch (error) {
      console.error("[AiService] Failed to connect to MCP servers:", error);
      // Continue without MCP tools - graceful degradation
    }

    // TODO: Use iterations once pause_turn is implemented
    // let iterations = 0;

    // This while loop is only to allow iterating on multipe "pause" stop reasons
    // while (iterations < MAX_ITERATIONS) {
    //   iterations++;

    const messages: BetaMessageParam[] = task.turns.map(
      (turn): BetaMessageParam => {
        return {
          role: turn.type as "user" | "assistant",
          content: turn.blocks.map((block) => block.content),
        };
      }
    );

    // Get container ID from turns metadata (search from latest to find most recent container)
    const containerId = task.turns
      .slice()
      .reverse()
      .map((turn) => (turn.metadata as { container?: { id: string } } | null)?.container?.id)
      .find((id) => id !== undefined);

    const assistantTurnProcessor = new AssistantTurnProcessor(
      this.db,
      taskId,
      task.organisation_id,
      DEFAULT_MODEL,
      toolToMcpId
    );

    let lastFlush = Date.now();

    // Extract skills for this task
    const taskSkillsList =
      task.taskSkills?.map((ts) => ({
        id: ts.skill.id,
        name: ts.skill.name,
        description: ts.skill.description,
      })) ?? [];

    try {
      for await (const event of agentLoop({
        messages,
        tools,
        mcpTools,
        cwd: task.metadata?.cwd,
        container: containerId,
        skills: taskSkillsList,
      })) {
        switch (event.type) {
          case "message_start": {
            assistantTurnProcessor.processMessageStart(event);
            break;
          }
          case "message_delta": {
            assistantTurnProcessor.processMessageDelta(event);
            break;
          }
          case "message_stop": {
            await assistantTurnProcessor.processMessageStop();
            break;
          }
          case "content_block_start": {
            assistantTurnProcessor.processBlockStart(event);
            break;
          }
          case "content_block_delta": {
            assistantTurnProcessor.processBlockDelta(event);
            break;
          }
          case "content_block_stop": {
            assistantTurnProcessor.processBlockStop(event);
            break;
          }
        }

        if (Date.now() - lastFlush > 200) {
          await assistantTurnProcessor.flushToDb();
          lastFlush = Date.now();
        }
      }
    } finally {
      // Always disconnect MCP connections when done
      await this.mcpService.disconnectAllConnections(mcpConnections);
    }

    // }
  }
}
