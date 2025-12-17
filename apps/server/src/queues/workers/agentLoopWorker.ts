import { createQueue, createWorker } from "../factory";
import { ReservedJob } from "groupmq";

const queueName = "agent-loop";

const queue = createQueue(queueName);

interface AgentLoopJobData {
  message: string;
  group?: string;
}

const worker = createWorker(
  queue,
  async (job: ReservedJob<AgentLoopJobData>) => {
    const { message, group } = job.data;
    console.log(`🟢 ${queue.name} worker started : ${group}`, job.id);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    return `result: ${message} from group ${group}`;
  }
);

worker.run()

const addToAgentLoopQueue = async (data: AgentLoopJobData) => {
  const group = Math.floor(Math.random() * 50);
  await queue.add({
    groupId: group.toString(),
    data: {
      ...data,
      group: group.toString(),
    },
  });
};

export { worker, addToAgentLoopQueue, queue };
