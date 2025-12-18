import { state } from "../../config/state";
import { AiService } from "../../services/ai.service";
import { createQueue, createWorker } from "../factory";
import { ReservedJob } from "groupmq";

const queueName = "agent-loop";

const queue = createQueue(queueName);

interface AgentLoopJobData {
  task_id: string;
  turn_id: string;
  block_id: string;
}

const worker = createWorker(
  queue,
  async (job: ReservedJob<AgentLoopJobData>) => {
    const aiService = AiService.getInstance(state);

    await aiService.runAgentLoop(
      job.data.task_id,
      job.data.turn_id,
      job.data.block_id
    );

    return;
  }
);

worker.run();

const addToAgentLoopQueue = async (data: AgentLoopJobData) => {
  await queue.add({
    groupId: data.task_id,
    data,
  });
};

export { worker, addToAgentLoopQueue, queue };
