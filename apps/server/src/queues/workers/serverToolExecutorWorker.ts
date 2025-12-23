import { state } from "../../config/state";
import { createQueue, createWorker } from "../factory";
import { ReservedJob } from "groupmq";
import { executeServerTool } from "../../server-tools/executor";
import { blocks } from "@jupiter/sync/db/schema";
import { eq } from "drizzle-orm";
import { addToAgentLoopQueue } from "./agentLoopWorker";
import type { ToolResultBlockParam, ToolUseBlockParam } from "@anthropic-ai/sdk/resources";

const queueName = "server-tool-executor";

const queue = createQueue(queueName);

export interface ServerToolJobData {
  task_id: string;
  turn_id: string; // The response turn (user turn waiting for results)
  block_id: string; // The tool_use block (database ID)
  tool_name: string;
  tool_input: unknown;
}

const worker = createWorker(
  queue,
  async (job: ReservedJob<ServerToolJobData>) => {
    const { task_id, turn_id, block_id, tool_name, tool_input } = job.data;
    const db = state.db;

    // Fetch the tool_use block to get the Anthropic API tool_use_id
    const toolBlock = await db.query.blocks.findFirst({
      where: eq(blocks.id, block_id),
    });

    if (!toolBlock) {
      throw new Error(`Tool block not found: ${block_id}`);
    }

    const toolUseId = (toolBlock.content as ToolUseBlockParam).id;

    // Execute the server tool
    let result: unknown;
    let isError = false;

    try {
      result = await executeServerTool(tool_name, tool_input, {
        taskId: task_id,
        turnId: turn_id,
        blockId: block_id,
        db,
      });
    } catch (error) {
      isError = true;
      result = error instanceof Error ? error.message : String(error);
    }

    // Create tool_result block in the response turn
    const resultBlockId = crypto.randomUUID();

    await db.insert(blocks).values({
      id: resultBlockId,
      turn_id: turn_id,
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
    await db
      .update(blocks)
      .set({
        status: "completed",
        updated_at: new Date(),
      })
      .where(eq(blocks.id, block_id));

    // Add job to agent-loop queue to process the tool_result
    await addToAgentLoopQueue({
      task_id,
      turn_id,
      block_id: resultBlockId,
    });
  }
);

worker.run();

const addToServerToolExecutorQueue = async (data: ServerToolJobData) => {
  await queue.add({
    groupId: data.task_id,
    data,
  });
};

export { worker, addToServerToolExecutorQueue, queue };
