import { Job } from "bullmq";
import { createQueue, createWorker } from "../factory";

const queueName = "agent-loop";

const queue = createQueue(queueName);

interface AgentLoopJobData {
  message: string;
}

const worker = createWorker(queueName, async (job: Job<AgentLoopJobData>) => {
  const { message } = job.data;
  return `result: ${message}`;
});

const addToAgentLoopQueue = async (message: string) => {
  await queue.add("agent-loop", { message });
};

export { worker, addToAgentLoopQueue, queue };
