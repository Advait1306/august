import { createQueue, createWorker } from "../factory";

const queueName = "agent-loop";

const queue = createQueue(queueName);

const worker = createWorker(queueName, async (job) => {
  const { message } = job.data;
  return `result: ${message}`;
});

const addToAgentLoopQueue = async (message: string) => {
  await queue.add("agent-loop", { message });
};

export { worker, addToAgentLoopQueue, queue };
