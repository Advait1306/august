import { state } from "../../config/state";
import { createQueue, createWorker } from "../factory";
import { ReservedJob } from "groupmq";
import {
  ToolService,
  ServerToolJobData,
} from "../../services/tool.service";

const queueName = "server-tool-executor";

const queue = createQueue(queueName);

const worker = createWorker(
  queue,
  async (job: ReservedJob<ServerToolJobData>) => {
    const toolService = ToolService.getInstance(state);

    await toolService.executeServerTool(
      job.data.task_id,
      job.data.turn_id,
      job.data.block_id,
      job.data.tool_name,
      job.data.tool_input
    );
  }
);

worker.run();

const addToServerToolExecutorQueue = async (data: ServerToolJobData) => {
  await queue.add({
    groupId: data.task_id,
    data,
  });
};

export { worker, addToServerToolExecutorQueue, queue, ServerToolJobData };
