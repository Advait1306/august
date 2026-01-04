import { eq } from "drizzle-orm";
import { state } from "../../config/state";
import { createQueue, createWorker } from "../factory";
import { ReservedJob } from "groupmq";
import { ToolService } from "../../services/tool.service";
import { McpService } from "../../services/mcp.service";
import { OAuthService } from "../../services/oauth.service";
import { ComposioService } from "../../services/composio.service";
import { mcps } from "@jupiter/sync/db/schema";

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
    const mcpService = McpService.getInstance(state.db);
    const oauthService = OAuthService.getInstance(state.db);
    const composioService = ComposioService.getInstance(state.db);

    // Fetch MCP info
    const [mcp] = await state.db
      .select()
      .from(mcps)
      .where(eq(mcps.id, job.data.mcp_id))
      .limit(1);

    if (!mcp) {
      throw new Error(`MCP not found: ${job.data.mcp_id}`);
    }

    let serverUrl: string | null = null;
    let authToken: string | undefined;

    if (mcp.integration_type === "oauth") {
      serverUrl = await mcpService.getMcpServerUrl(mcp);
      authToken =
        (await oauthService.getAccessToken({ mcpId: mcp.id })) ?? undefined;
    } else if (mcp.integration_type === "composio") {
      serverUrl = await composioService.getConnectionUrl({ mcpId: mcp.id });
    }

    if (!serverUrl) {
      throw new Error(`No server URL found for MCP: ${mcp.name}`);
    }

    await toolService.executeMcpTool(
      job.data.task_id,
      job.data.turn_id,
      job.data.block_id,
      job.data.tool_name,
      job.data.tool_input,
      { mcpName: mcp.name, serverUrl, authToken }
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
