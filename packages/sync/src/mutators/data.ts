import { Transaction } from "@rocicorp/zero";
import { Schema } from "../zero/schema";

type AuthData = {
  userId: string;
  orgId: string;
};

export function createMutators(authData: AuthData) {
  return {
    projects: {
      create: async (
        tx: Transaction<Schema>,
        {
          project_id,
          name,
          path,
        }: { project_id: string; name: string; path: string }
      ) => {
        await tx.mutate.projects.insert({
          id: project_id,
          name,
          path,
          author_id: authData.userId,
          organisation_id: authData.orgId,
        });
      },
      update: async (
        tx: Transaction<Schema>,
        {
          project_id,
          name,
          path,
        }: { project_id: string; name: string; path: string }
      ) => {
        await tx.mutate.projects.update({
          id: project_id,
          name,
          path,
        });
      },
      delete: async (
        tx: Transaction<Schema>,
        { project_id }: { project_id: string }
      ) => {
        await tx.mutate.projects.delete({ id: project_id });
      },
    },
    agents: {
      create: async (
        tx: Transaction<Schema>,
        {
          agent_id,
          name,
          system_prompt,
          base_agent,
        }: {
          agent_id: string;
          name: string;
          system_prompt: string;
          base_agent: "claude-code" | "codex" | "opencode";
        }
      ) => {
        await tx.mutate.agents.insert({
          id: agent_id,
          name,
          system_prompt,
          base_agent,
          author_id: authData.userId,
          organisation_id: authData.orgId,
        });
      },
      update: async (
        tx: Transaction<Schema>,
        {
          agent_id,
          name,
          system_prompt,
        }: {
          agent_id: string;
          name: string;
          system_prompt: string;
        }
      ) => {
        await tx.mutate.agents.update({
          id: agent_id,
          name,
          system_prompt,
        });
      },
      delete: async (
        tx: Transaction<Schema>,
        { agent_id }: { agent_id: string }
      ) => {
        await tx.mutate.agents.delete({ id: agent_id });
      },
    },
    tasks: {
      create: async (
        tx: Transaction<Schema>,
        {
          task_id,
          project_id,
          agent_id,
          message_data,
        }: {
          task_id: string;
          project_id: string;
          agent_id: string;
          message_data: {
            task_id: string;
            message_id: string;
            role: string;
            content: Record<string, any>[];
            metadata: Record<string, any>;
          };
        }
      ) => {
        const name = message_data.content.find((part) => part.type === "text")
          ?.text
          ? (() => {
              const text = message_data.content.find(
                (part) => part.type === "text"
              )!.text;
              return text.length > 40 ? text.slice(0, 40) + "..." : text;
            })()
          : "New Task";

        await tx.mutate.tasks.insert({
          id: task_id,
          author_id: authData.userId,
          name,
          project_id,
          agent_id,
          organisation_id: authData.orgId,
          created_at: Date.now(),
        });

        await tx.mutate.messages.upsert({
          id: message_data.message_id,
          task_id,
          message_id: message_data.message_id,
          role: message_data.role,
          content: message_data.content,
          metadata: message_data.metadata,
          created_at: Date.now(),
        });
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
        await tx.mutate.messages.insert({
          id: message_id,
          task_id,
          message_id: message_id,
          role: role,
          content: content,
          metadata: metadata,
          created_at: Date.now(),
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
        await tx.mutate.messages.update({
          id: message_id,
          task_id,
          message_id: message_id,
          role: role,
          content: content,
          metadata: metadata,
        });
      },
    },
    mcps: {
      create: async (
        tx: Transaction<Schema>,
        {
          id,
          mcp_store_id,
          name,
          mcp_server_url,
          custom_mcp_url,
          custom_description,
        }: {
          id: string;
          mcp_store_id?: string | null;
          name: string;
          mcp_server_url: string;
          custom_mcp_url?: string | null;
          custom_description?: string | null;
        }
      ) => {
        await tx.mutate.mcps.insert({
          id,
          mcp_store_id: mcp_store_id ?? null,
          name,
          mcp_server_url,
          custom_mcp_url: custom_mcp_url ?? null,
          custom_description: custom_description ?? null,
          author_id: authData.userId,
          organisation_id: authData.orgId,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      },
      delete: async (
        tx: Transaction<Schema>,
        { mcp_id }: { mcp_id: string }
      ) => {
        await tx.mutate.mcps.delete({ id: mcp_id });
      },
    },
  } as const;
}

export type Mutators = ReturnType<typeof createMutators>;
