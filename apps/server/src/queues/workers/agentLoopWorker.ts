import { eq } from "drizzle-orm";
import { state } from "../../config/state";
import { AiService, McpContext } from "../../services/ai.service";
import { McpService } from "../../services/mcp.service";
import { OAuthService } from "../../services/oauth.service";
import { ComposioService } from "../../services/composio.service";
import { createQueue, createWorker } from "../factory";
import { ReservedJob } from "groupmq";
import { tasks } from "@jupiter/sync/db/schema";
import { McpConnection } from "@august/harness";

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
    const mcpService = McpService.getInstance(state.db);
    const oauthService = OAuthService.getInstance(state.db);
    const composioService = ComposioService.getInstance(state.db);

    // Process the block and check if agent loop should run
    const shouldRunAgentLoop = await aiService.processBlock(
      job.data.task_id,
      job.data.turn_id,
      job.data.block_id
    );

    if (!shouldRunAgentLoop) {
      return;
    }

    // Get task to find the author (user)
    const task = await state.db.query.tasks.findFirst({
      where: eq(tasks.id, job.data.task_id),
    });

    if (!task) {
      throw new Error("Task not found");
    }

    // Fetch and connect to MCPs
    let mcpContext: McpContext | undefined;
    const connections: McpConnection[] = [];

    try {
      const userMcps = await mcpService.getUserMcps(task.author_id);

      for (const mcp of userMcps) {
        try {
          let serverUrl: string | null = null;
          let authToken: string | undefined;

          if (mcp.integration_type === "oauth") {
            serverUrl = await mcpService.getMcpServerUrl(mcp);
            authToken = await oauthService.getAccessToken({ mcpId: mcp.id }) ?? undefined;
          } else if (mcp.integration_type === "composio") {
            serverUrl = await composioService.getConnectionUrl({ mcpId: mcp.id });
          }

          if (serverUrl) {
            const connection = await mcpService.connectToMcp({
              name: mcp.name,
              url: serverUrl,
              authToken,
            });
            connections.push(connection);
          }
        } catch (error) {
          console.error(`Failed to connect to MCP ${mcp.name}:`, error);
          // Continue with other MCPs
        }
      }

      if (connections.length > 0) {
        const tools = mcpService.getToolsFromConnections(connections);
        const toolToMcpId = mcpService.buildToolToMcpIdMap(connections, userMcps.map(m => m.id));
        mcpContext = { connections, tools, toolToMcpId };
      }

      await aiService.runAgentLoop(job.data.task_id, mcpContext);
    } finally {
      // Always disconnect
      await mcpService.disconnectAllConnections(connections);
    }
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
