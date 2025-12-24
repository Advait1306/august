/**
 * Tool service - handles execution of server-side and MCP tools
 */

import { eq } from "drizzle-orm";
import { AppState } from "../config/state";
import { getServerTool } from "../server-tools";
import {
  blocks,
  mcps,
  mcpOauthIntegrationDetails,
} from "@jupiter/sync/db/schema";
import { addToAgentLoopQueue } from "../queues/workers/agentLoopWorker";
import { OAuthService } from "./oauth.service";
import { ComposioService } from "./composio.service";
import { connectMcpServer } from "@august/harness";
import type {
  ToolResultBlockParam,
  ToolUseBlockParam,
} from "@anthropic-ai/sdk/resources";

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

  /**
   * Execute an MCP tool and handle the result
   *
   * @param taskId - The task ID
   * @param turnId - The response turn (user turn waiting for results)
   * @param blockId - The tool_use block (database ID)
   * @param toolName - The name of the tool to execute
   * @param toolInput - The tool input
   * @param mcpId - The MCP server ID to execute the tool on
   */
  async executeMcpTool(
    taskId: string,
    turnId: string,
    blockId: string,
    toolName: string,
    toolInput: unknown,
    mcpId: string
  ): Promise<void> {
    // Fetch the tool_use block to get the Anthropic API tool_use_id
    const toolBlock = await this.db.query.blocks.findFirst({
      where: eq(blocks.id, blockId),
    });

    if (!toolBlock) {
      throw new Error(`Tool block not found: ${blockId}`);
    }

    const toolUseId = (toolBlock.content as ToolUseBlockParam).id;

    // Execute the MCP tool
    let result: unknown;
    let isError = false;

    try {
      result = await this.executeToolOnMcp({
        mcpId,
        toolName,
        args: toolInput as Record<string, unknown>,
      });
    } catch (error) {
      isError = true;
      result = error instanceof Error ? error.message : String(error);
      console.error(`[ToolService] MCP tool execution failed:`, error);
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
        content:
          typeof result === "string" ? result : JSON.stringify(result),
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

  /**
   * Execute a tool on an MCP server
   * Creates a temporary connection, executes the tool, and disconnects
   */
  private async executeToolOnMcp(params: {
    mcpId: string;
    toolName: string;
    args: Record<string, unknown>;
  }): Promise<unknown> {
    const { mcpId, toolName, args } = params;

    // Fetch the MCP
    const [mcp] = await this.db
      .select()
      .from(mcps)
      .where(eq(mcps.id, mcpId))
      .limit(1);

    if (!mcp) {
      throw new Error(`MCP not found: ${mcpId}`);
    }

    const oauthService = new OAuthService(this.db);
    const composioService = new ComposioService(this.db);

    let serverUrl: string | null = null;
    let authToken: string | null = null;

    switch (mcp.integration_type) {
      case "oauth": {
        // Get the MCP server URL
        if (mcp.mcp_store_id) {
          const [oauthDetails] = await this.db
            .select()
            .from(mcpOauthIntegrationDetails)
            .where(eq(mcpOauthIntegrationDetails.mcp_store_id, mcp.mcp_store_id))
            .limit(1);

          if (oauthDetails) {
            serverUrl = oauthDetails.mcp_server_url;
          }
        } else if (mcp.custom_mcp_server_url) {
          serverUrl = mcp.custom_mcp_server_url;
        }

        if (!serverUrl) {
          throw new Error(`No server URL found for OAuth MCP: ${mcpId}`);
        }

        // Get the access token
        authToken = await oauthService.getAccessToken({ mcpId });

        if (!authToken) {
          throw new Error(`No access token found for MCP: ${mcpId}`);
        }
        break;
      }
      case "composio": {
        serverUrl = await composioService.getConnectionUrl({ mcpId });

        if (!serverUrl) {
          throw new Error(`No Composio connection URL found for MCP: ${mcpId}`);
        }
        break;
      }
    }

    if (!serverUrl) {
      throw new Error(`No server URL found for MCP: ${mcpId}`);
    }

    console.log(`[ToolService] Executing tool ${toolName} on MCP: ${mcp.name} (${mcpId})`);

    // Connect to the MCP
    const connection = await connectMcpServer({
      name: mcp.name,
      url: serverUrl,
      authToken: authToken ?? undefined,
    });

    try {
      // Execute the tool
      const result = await connection.execute(toolName, args);
      console.log(`[ToolService] Tool ${toolName} executed successfully`);
      return result;
    } finally {
      // Always disconnect
      await connection.disconnect();
    }
  }
}
