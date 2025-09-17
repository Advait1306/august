import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  BaseAgent,
  Agent,
  AgentMemory,
  NewAgent,
  NewAgentMemory,
  AgentWithDetails,
} from "../types/agent";

interface AgentStore {
  agents: Agent[];
  baseAgents: BaseAgent[];
  isLoading: boolean;

  // Actions
  setAgents: (agents: Agent[]) => void;
  setBaseAgents: (baseAgents: BaseAgent[]) => void;
  setLoading: (loading: boolean) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (agentId: string) => void;
  updateAgent: (agentId: string, updates: Partial<Agent>) => void;

  // Base agent actions (limited)
  loadBaseAgents: () => Promise<void>;
  updateBaseAgentApiKey: (id: string, apiKey: string) => Promise<BaseAgent>;

  // Custom agent actions (full CRUD)
  loadAgents: () => Promise<void>;
  createAgent: (data: NewAgent) => Promise<Agent>;
  getAgentDetails: (id: string) => Promise<AgentWithDetails>;
  updateAgentData: (id: string, data: Partial<NewAgent>) => Promise<Agent>;
  deleteAgent: (id: string) => Promise<void>;

  // Memory management
  loadMemories: (agentId: string) => Promise<AgentMemory[]>;
  addMemory: (data: NewAgentMemory) => Promise<AgentMemory>;
  updateMemory: (id: string, memory: string) => Promise<AgentMemory>;
  deleteMemory: (id: string) => Promise<void>;
}

export const useAgentStore = create<AgentStore>()(
  devtools(
    (set, get) => ({
      agents: [],
      baseAgents: [],
      isLoading: false,
      selectedAgent: null,

      setAgents: (agents) => set({ agents }),
      setBaseAgents: (baseAgents) => set({ baseAgents }),
      setLoading: (loading) => set({ isLoading: loading }),

      addAgent: (agent) =>
        set((state) => ({ agents: [...state.agents, agent] })),

      removeAgent: (agentId) =>
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== agentId),
        })),

      updateAgent: (agentId, updates) =>
        set((state) => ({
          agents: state.agents.map((agent) =>
            agent.id === agentId ? { ...agent, ...updates } : agent
          ),
        })),

      // Base agent actions
      loadBaseAgents: async () => {
        set({ isLoading: true });
        try {
          const rawBaseAgents = await window.api.agent.baseAgents.getAll();
          const baseAgents = rawBaseAgents.map((agent) => ({
            ...agent,
            createdAt: new Date(agent.createdAt),
          }));
          set({ baseAgents, isLoading: false });
        } catch (error) {
          console.error("Failed to load base agents:", error);
          set({ isLoading: false });
        }
      },

      updateBaseAgentApiKey: async (id: string, apiKey: string) => {
        try {
          const rawUpdated = await window.api.agent.baseAgents.updateApiKey(
            id,
            apiKey
          );
          const updated = {
            ...rawUpdated,
            createdAt: new Date(rawUpdated.createdAt),
          };
          set((state) => ({
            baseAgents: state.baseAgents.map((agent) =>
              agent.id === id ? updated : agent
            ),
          }));
          return updated;
        } catch (error) {
          console.error("Failed to update base agent API key:", error);
          throw error;
        }
      },

      // Custom agent actions
      loadAgents: async () => {
        set({ isLoading: true });
        try {
          const rawAgents = await window.api.agent.agents.getAll();
          const agents = rawAgents.map((agent) => ({
            ...agent,
            createdAt: new Date(agent.createdAt),
          }));
          set({ agents, isLoading: false });
        } catch (error) {
          console.error("Failed to load agents:", error);
          set({ isLoading: false });
        }
      },

      createAgent: async (data: NewAgent) => {
        try {
          const rawAgent = await window.api.agent.agents.create(data);
          const agent = {
            ...rawAgent,
            createdAt: new Date(rawAgent.createdAt),
          };
          get().addAgent(agent);
          return agent;
        } catch (error) {
          console.error("Failed to create agent:", error);
          throw error;
        }
      },

      getAgentDetails: async (id: string) => {
        try {
          const agentDetails = await window.api.agent.agents.get(id);
          // Convert dates from strings to Date objects
          const processedAgent: AgentWithDetails = {
            ...agentDetails,
            createdAt: new Date(agentDetails.createdAt),
            baseAgent: {
              ...agentDetails.baseAgent,
              createdAt: new Date(agentDetails.baseAgent.createdAt),
            },
            memories: agentDetails.memories.map((mem) => ({
              ...mem,
              createdAt: new Date(mem.createdAt),
            })),
          };
          return processedAgent;
        } catch (error) {
          console.error("Failed to get agent details:", error);
          throw error;
        }
      },

      updateAgentData: async (id: string, data: Partial<NewAgent>) => {
        try {
          const rawUpdated = await window.api.agent.agents.update(id, data);
          const updated = {
            ...rawUpdated,
            createdAt: new Date(rawUpdated.createdAt),
          };
          get().updateAgent(id, updated);
          return updated;
        } catch (error) {
          console.error("Failed to update agent:", error);
          throw error;
        }
      },

      deleteAgent: async (id: string) => {
        try {
          await window.api.agent.agents.delete(id);
          get().removeAgent(id);
        } catch (error) {
          console.error("Failed to delete agent:", error);
          throw error;
        }
      },

      // Memory management
      loadMemories: async (agentId: string) => {
        try {
          const memories = await window.api.agent.memories.getAll(agentId);
          return memories.map((mem) => ({
            ...mem,
            createdAt: new Date(mem.createdAt),
          }));
        } catch (error) {
          console.error("Failed to load memories:", error);
          throw error;
        }
      },

      addMemory: async (data: NewAgentMemory) => {
        try {
          const memory = await window.api.agent.memories.add(data);
          return {
            ...memory,
            createdAt: new Date(memory.createdAt),
          };
        } catch (error) {
          console.error("Failed to add memory:", error);
          throw error;
        }
      },

      updateMemory: async (id: string, memory: string) => {
        try {
          const updated = await window.api.agent.memories.update(id, memory);
          return {
            ...updated,
            createdAt: new Date(updated.createdAt),
          };
        } catch (error) {
          console.error("Failed to update memory:", error);
          throw error;
        }
      },

      deleteMemory: async (id: string) => {
        try {
          await window.api.agent.memories.delete(id);
        } catch (error) {
          console.error("Failed to delete memory:", error);
          throw error;
        }
      },
    }),
    { name: "agent-store" }
  )
);
