/**
 * Tool service - handles execution of server-side and MCP tools
 */

import { eq } from "drizzle-orm";
import { AppState } from "../config/state";
import { getServerTool } from "../server-tools";
import { blocks } from "@jupiter/sync/db/schema";
import { addToAgentLoopQueue } from "../queues/workers/agentLoopWorker";
import type {
  ToolResultBlockParam,
  ToolUseBlockParam,
} from "@anthropic-ai/sdk/resources";

export interface ServerToolJobData {
  task_id: string;
  turn_id: string; // The response turn (user turn waiting for results)
  block_id: string; // The tool_use block (database ID)
  tool_name: string;
  tool_input: unknown;
}

export class ToolService {
  private static instance: ToolService;
  private constructor(private db: AppState["db"]) {}

  public static getInstance(state: AppState) {
    if (!ToolService.instance) {
      ToolService.instance = new ToolService(state.db);
    }
    return ToolService.instance;
  }

  /**
   * Execute a server-side tool and handle the result
   *
   * @param taskId - The task ID
   * @param turnId - The response turn (user turn waiting for results)
   * @param blockId - The tool_use block (database ID)
   * @param toolName - The name of the tool to execute
   * @param toolInput - The tool input
   */
  async executeServerTool(
    taskId: string,
    turnId: string,
    blockId: string,
    toolName: string,
    toolInput: unknown
  ): Promise<void> {

    // Fetch the tool_use block to get the Anthropic API tool_use_id
    const toolBlock = await this.db.query.blocks.findFirst({
      where: eq(blocks.id, blockId),
    });

    if (!toolBlock) {
      throw new Error(`Tool block not found: ${blockId}`);
    }

    const toolUseId = (toolBlock.content as ToolUseBlockParam).id;

    // Execute the server tool
    let result: unknown;
    let isError = false;

    try {
      const tool = getServerTool(toolName);

      if (!tool) {
        throw new Error(`Unknown server tool: ${toolName}`);
      }

      // Validate input against schema
      const parsedInput = tool.inputSchema.parse(toolInput);

      // Execute the tool
      const output = await tool.execute(parsedInput, {
        taskId,
        turnId,
        blockId,
        db: this.db,
      });

      // Validate output against schema
      result = tool.outputSchema.parse(output);
    } catch (error) {
      isError = true;
      result = error instanceof Error ? error.message : String(error);
    }

    // Create tool_result block in the response turn
    const resultBlockId = crypto.randomUUID();

    await this.db.insert(blocks).values({
      id: resultBlockId,
      turn_id: turnId,
      type: "tool_result",
      status: "none",
      complete: true,
      content: {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: JSON.stringify(result),
        is_error: isError,
      } as ToolResultBlockParam,
      created_at: new Date(),
      updated_at: new Date(),
      processed: false,
    });

    // Mark the tool_use block as completed
    await this.db
      .update(blocks)
      .set({
        status: "completed",
        updated_at: new Date(),
      })
      .where(eq(blocks.id, blockId));

    // Add job to agent-loop queue to process the tool_result
    await addToAgentLoopQueue({
      task_id: taskId,
      turn_id: turnId,
      block_id: resultBlockId,
    });
  }

  // TODO: Add executeMcpTool method when MCP tools are implemented
}
