import { state } from "../../config/state";
import { createQueue, createWorker } from "../factory";
import { ReservedJob } from "groupmq";
import { ToolService } from "../../services/tool.service";

const queueName = "mcp-tool-executor";

const queue = createQueue(queueName);

interface McpToolJobData {
  task_id: string;
  turn_id: string; // The response turn (user turn waiting for results)
  block_id: string; // The tool_use block (database ID)
  tool_name: string;
  tool_input: unknown;
  mcp_id: string; // The MCP server ID to execute the tool on
}

const worker = createWorker(
  queue,
  async (job: ReservedJob<McpToolJobData>) => {
    const toolService = ToolService.getInstance(state);

    await toolService.executeMcpTool(
      job.data.task_id,
      job.data.turn_id,
      job.data.block_id,
      job.data.tool_name,
      job.data.tool_input,
      job.data.mcp_id
    );
  }
);

worker.run();

const addToMcpToolExecutorQueue = async (data: McpToolJobData) => {
  await queue.add({
    groupId: data.task_id,
    data,
  });
};

export { worker, addToMcpToolExecutorQueue, queue, McpToolJobData };
