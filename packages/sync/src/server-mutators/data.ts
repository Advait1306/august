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
  oauthService?: OAuthService
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
          agent_id: args.agent_id,
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
    mcps: {
      delete: async (
        tx: Transaction<Schema>,
        { mcp_id }: { mcp_id: string }
      ) => {
        // Check if MCP belongs to user
        const mcp = tx.query.mcps
          .where("id", mcp_id)
          .where("author_id", authData.userId)
          .one();

        if (!mcp) {
          throw new Error("MCP not found or access denied");
        }

        // Revoke OAuth tokens with the provider (async)
        if (oauthService) {
          asyncTasks.push(async () => {
            try {
              await oauthService.revokeToken({ mcpId: mcp_id });
            } catch (error) {
              console.error("[Server Mutator] Error revoking OAuth token:", error);
            }
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
        // Check if task belongs to user
        const task = tx.query.tasks
          .where("id", task_id)
          .where("author_id", authData.userId)
          .one();

        if (!task) {
          throw new Error("Task not found with user");
        }

        await tx.mutate.messages.insert({
          id: message_id,
          task_id,
          message_id,
          role,
          content,
          metadata,
          created_at: Date.now(),
        });

        // Track analytics manually for custom mutator
        await trackEvent("message_created", {
          task_id,
          message_id,
          role,
        });
      },

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
  } as const;
}
