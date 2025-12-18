// server-mutators.ts
import { CustomMutatorDefs, Transaction } from "@rocicorp/zero";
import { Schema } from "../zero/schema";
import { wrapMutatorsWithAnalytics } from "./analytics-wrapper";
import mixpanel from "mixpanel";

type AuthData = {
  userId: string;
  orgId: string;
};

type AsyncTask = Array<() => Promise<void>>;

type OAuthService = {
  revokeToken: (params: { mcpId: string }) => Promise<void>;
};

export function createServerMutators(
  clientMutators: CustomMutatorDefs,
  authData: AuthData,
  asyncTasks: AsyncTask,
  mixpanel: mixpanel.Mixpanel,
  oauthService: OAuthService
) {
  // Analytics configuration
  const analyticsConfig = {
    projects: {
      create: {
        event: "project_created",
        getProperties: (args: any) => ({
          project_id: args.project_id,
          name: args.name,
        }),
      },
      update: {
        event: "project_updated",
        getProperties: (args: any) => ({ project_id: args.project_id }),
      },
      delete: {
        event: "project_deleted",
        getProperties: (args: any) => ({ project_id: args.project_id }),
      },
    },
    agents: {
      create: {
        event: "agent_created",
        getProperties: (args: any) => ({
          agent_id: args.agent_id,
          base_agent: args.base_agent,
        }),
      },
      update: {
        event: "agent_updated",
        getProperties: (args: any) => ({ agent_id: args.agent_id }),
      },
      delete: {
        event: "agent_deleted",
        getProperties: (args: any) => ({ agent_id: args.agent_id }),
      },
    },
    tasks: {
      create: {
        event: "task_created",
        getProperties: (args: any) => ({
          task_id: args.task_id,
          project_id: args.project_id,
          ...(args.agent_id && { agent_id: args.agent_id }),
        }),
      },
    },
    message: {
      create: {
        event: "message_created",
        getProperties: (args: any) => ({
          task_id: args.task_id,
          message_id: args.message_id,
          role: args.role,
        }),
      },
      update: {
        event: "message_updated",
        getProperties: (args: any) => ({
          task_id: args.task_id,
          message_id: args.message_id,
        }),
      },
    },
  };

  // Analytics tracking function
  const trackEvent = async (event: string, properties: Record<string, any>) => {
    asyncTasks.push(async () => {
      mixpanel.track(event, {
        $user_id: authData.userId,
        org_id: authData.orgId,
        ...properties,
      });
    });
  };

  // Wrap client mutators with analytics
  const wrappedMutators = wrapMutatorsWithAnalytics(
    clientMutators,
    analyticsConfig,
    trackEvent
  );

  // Override specific mutators that need custom server-side logic
  return {
    ...wrappedMutators,
    tasks: {
      create: async (
        tx: Transaction<Schema>,
        {
          message,
          task_id,
          turn_id,
          block_id,
        }: {
          message: string;
          task_id: string;
          turn_id: string;
          block_id: string;
        }
      ) => {
        await tx.mutate.tasks.insert({
          id: task_id,
          name: message.length > 40 ? message.slice(0, 40) + "..." : message,
          author_id: authData.userId,
          organisation_id: authData.orgId,
          status: "starting",
          created_at: Date.now(),
          updated_at: Date.now(),
        });

        await tx.mutate.turns.insert({
          id: turn_id,
          type: "user",
          task_id: task_id,
          complete: true,
          created_at: Date.now(),
          updated_at: Date.now(),
          locked: true,
        });

        await tx.mutate.blocks.insert({
          id: block_id,
          turn_id: turn_id,
          type: "text",
          content: {
            text: message,
          },
          created_at: Date.now(),
          updated_at: Date.now(),
          processed: false,
        });

        asyncTasks.push(async () => {
          // TODO: Create a task processing job
        });
      },
      abort: async (
        tx: Transaction<Schema>,
        {
          task_id,
        }: {
          task_id: string;
        }
      ) => {
        const task = await tx.query.tasks
          .where("id", task_id)
          .where("author_id", authData.userId)
          .one()
          .run();

        if (!task) {
          throw new Error("Task not found with user");
        }

        if (task.status !== "executing") {
          throw new Error("Can't stop a non-executing task");
        }

        await tx.mutate.tasks.update({
          id: task_id,
          status: "stopping",
        });

        asyncTasks.push(async () => {
          // TODO: Create a task stop processing job
        });
      },
    },
    mcps: {
      delete: async (
        tx: Transaction<Schema>,
        { mcp_id }: { mcp_id: string }
      ) => {
        // Check if MCP belongs to user
        const mcp = await tx.query.mcps
          .where("id", mcp_id)
          .where("author_id", authData.userId)
          .one()
          .run();

        if (!mcp) {
          throw new Error("MCP not found or access denied");
        }

        if (mcp.integration_type === "oauth") {
          // Revoke OAuth token synchronously before deleting the connection
          try {
            // This will also delete the oauth token from the database
            await oauthService.revokeToken({ mcpId: mcp_id });
          } catch (error) {
            console.error(
              "[Server Mutator] Error revoking OAuth token:",
              error
            );
          }
        } else {
          const composioConnection = await tx.query.mcpComposioConnections
            .where("mcp_id", mcp_id)
            .one()
            .run();

          if (!composioConnection) {
            throw new Error("Composio connection not found");
          }

          // TODO: Figure out how to delete the Composio connection from composio SDK as well
          await tx.mutate.mcpComposioConnections.delete({
            id: composioConnection.id,
          });
        }

        // Delete the MCP from the database
        await tx.mutate.mcps.delete({ id: mcp_id });
      },
    },
    message: {
      create: async (
        tx: Transaction<Schema>,
        {
          message,
          task_id,
          turn_id,
          block_id,
        }: {
          message: string;
          task_id: string;
          turn_id: string;
          block_id: string;
        }
      ) => {
        const task = await tx.query.tasks
          .where("id", task_id)
          .where("author_id", authData.userId)
          .one()
          .run();

        if (!task) {
          throw new Error("Task not found with user");
        }

        if (task.status !== "available") {
          throw new Error("Task is not in available state");
        }

        await tx.mutate.tasks.update({
          id: task_id,
          status: "starting",
        });

        await tx.mutate.turns.insert({
          id: turn_id,
          type: "user",
          task_id: task_id,
          complete: true,
          created_at: Date.now(),
          updated_at: Date.now(),
          locked: true,
        });

        await tx.mutate.blocks.insert({
          id: block_id,
          turn_id: turn_id,
          type: "text",
          content: {
            text: message,
          },
        });

        asyncTasks.push(async () => {
          // TODO: Create a message processing job
        });
        // TODO: Add analytics event
      },

      // TODO: Remove update function as no longer needed
      update: async (
        tx: Transaction<Schema>,
        {
          task_id,
          message_id,
          role,
          content,
          metadata,
        }: {
          task_id: string;
          message_id: string;
          role: string;
          content: Record<string, any>[];
          metadata: Record<string, any>;
        }
      ) => {
        // Check if the task belongs to the user
        const task = tx.query.tasks
          .where("id", task_id)
          .where("author_id", authData.userId)
          .one();

        if (!task) {
          throw new Error("Task not found with user");
        }

        await tx.mutate.messages.update({
          id: message_id,
          task_id,
          message_id: message_id,
          role: role,
          content: content,
          metadata: metadata,
        });

        // Track analytics manually for custom mutator
        await trackEvent("message_updated", {
          task_id,
          message_id,
        });
      },
    },
    tools: {
      submitResult: async (
        tx: Transaction<Schema>,
        {
          tool_use_id,
          turn_id,
          result,
          block_id,
        }: {
          tool_use_id: string;
          turn_id: string;
          result: string;
          block_id: string;
        }
      ) => {
        const turn = await tx.query.turns
          .where("id", turn_id)
          .related("task", (q) => {
            return q.where("author_id", authData.userId);
          })
          .one()
          .run();

        if (!turn) {
          throw new Error("Turn not found");
        }

        if (turn.type !== "user") {
          throw new Error("Turn is not a user turn");
        }

        if (turn.locked) {
          throw new Error("Turn is locked");
        }

        await tx.mutate.blocks.insert({
          id: block_id,
          turn_id: turn_id,
          type: "tool_result",
          status: "completed",
          content: {
            tool_use_id,
            result,
          },
          created_at: Date.now(),
          updated_at: Date.now(),
          processed: false,
        });

        asyncTasks.push(async () => {
          // TODO: Create a tool result processing job
        });
        // TODO: Add analytics event
      },
      approve: async (
        tx: Transaction<Schema>,
        { block_id }: { block_id: string }
      ) => {
        const block = await tx.query.blocks
          .where("id", block_id)
          .related("turn", (q) => {
            return q.related("task", (s) => {
              return s.where("author_id", authData.userId);
            });
          })
          .one()
          .run();

        if (!block) {
          throw new Error("Block not found");
        }

        switch (block.type) {
          case "tool_use": {
            await tx.mutate.blocks.update({
              id: block_id,
              status: "client_pending",
            });
            break;
          }
          case "server_tool_use": {
            await tx.mutate.blocks.update({
              id: block_id,
              status: "server_pending",
            });
            break;
          }
          default: {
            throw new Error("Block doesn't support permission approval");
          }
        }

        asyncTasks.push(async () => {
          // TODO: Create a tool result processing job
        });
        // TODO: Add analytics event
      },
      deny: async (
        tx: Transaction<Schema>,
        {
          block_id,
          turn_id,
          reason,
          result_block_id,
        }: {
          block_id: string;
          turn_id: string;
          reason: string;
          result_block_id: string;
        }
      ) => {
        const block = await tx.query.blocks
          .where("id", block_id)
          .related("turn", (q) => {
            return q.related("task", (s) => {
              return s.where("author_id", authData.userId);
            });
          })
          .one()
          .run();

        if (!block) {
          throw new Error("Block not found");
        }

        if (block.type !== "tool_use" && block.type !== "server_tool_use") {
          throw new Error("Block doesn't support permission denial");
        }

        await tx.mutate.blocks.update({
          id: block_id,
          status: "completed",
        });

        await tx.mutate.blocks.insert({
          id: result_block_id,
          turn_id: turn_id,
          type: "tool_result",
          // TODO: Fix content here in order to match anthropic's expectations
          content: {
            reason,
            isError: true,
          },
          created_at: Date.now(),
          updated_at: Date.now(),
          processed: false,
          complete: true,
        });

        asyncTasks.push(async () => {
          // TODO: Create a tool result processing job
        });
        // TODO: Add analytics event
      },
    },
  } as const;
}
