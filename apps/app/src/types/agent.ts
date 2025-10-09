import { asyncGeneratorOverIPCConsumer } from "@jupiter/shared/async-generator-over-ipc-consumer";
import { electronAPI } from "@electron-toolkit/preload";
import { PermissionRequest } from "@jupiter/shared/types";
import { AssistantModelMessage, ModelMessage } from "ai";

// Define agent management types
export interface BaseAgent {
  id: string;
  name: string;
  apiKey: string | null;
  isBuiltIn: boolean;
  createdAt: Date;
}

export interface AgentMemory {
  id: string;
  agentId: string;
  memory: string;
  createdAt: Date;
}

export interface NewAgent {
  name: string;
  systemPrompt: string;
  baseAgentId: string;
}

export interface NewAgentMemory {
  agentId: string;
  memory: string;
}

export const agent = {
  // Agent execution
  run: (
    agentId: string, // Changed from agentName to agentId
    options: {
      messages: ModelMessage[];
      runConfig: Record<string, unknown>;
      threadId: string;
    }
  ) => {
    return asyncGeneratorOverIPCConsumer(async (id) => {
      await electronAPI.ipcRenderer.invoke("agent:run", id, agentId, options);
    });
  },

  // Permission handling
  addPermissionHandler: (cb: (request: PermissionRequest) => void) => {
    const removeListener = electronAPI.ipcRenderer.on(
      "permission:request",
      (_, request: PermissionRequest) => {
        cb(request);
      }
    );

    return () => {
      removeListener();
    };
  },

  grantPermission: (requestId: string) => {
    electronAPI.ipcRenderer.invoke(`permission:response-${requestId}`, true);
  },

  denyPermission: (requestId: string) => {
    electronAPI.ipcRenderer.invoke(`permission:response-${requestId}`, false);
  },

  // Base agent management
  baseAgents: {
    getAll: (): Promise<BaseAgent[]> =>
      electronAPI.ipcRenderer.invoke("base-agents:getAll"),
    updateApiKey: (id: string, apiKey: string): Promise<BaseAgent> =>
      electronAPI.ipcRenderer.invoke("base-agents:updateApiKey", id, apiKey),
  },

  // Memory management
  memories: {
    getAll: (agentId: string): Promise<AgentMemory[]> =>
      electronAPI.ipcRenderer.invoke("agents:getMemories", agentId),
    add: (data: NewAgentMemory): Promise<AgentMemory> =>
      electronAPI.ipcRenderer.invoke("agents:addMemory", data),
    update: (id: string, memory: string): Promise<AgentMemory> =>
      electronAPI.ipcRenderer.invoke("agents:updateMemory", id, memory),
    delete: (id: string): Promise<boolean> =>
      electronAPI.ipcRenderer.invoke("agents:deleteMemory", id),
  },
};

export type agentTypes = {
  run: (
    options: {
      messages: ModelMessage[];
      runConfig: Record<string, unknown>;
      threadId: string;
    },
    systemPrompt: string
  ) => AsyncGenerator<AssistantModelMessage, void>;

  addPermissionHandler: (
    cb: (request: PermissionRequest) => void
  ) => () => void;
  grantPermission: (requestId: string) => void;
  denyPermission: (requestId: string) => void;

  baseAgents: {
    getAll: () => Promise<BaseAgent[]>;
    updateApiKey: (id: string, apiKey: string) => Promise<BaseAgent>;
  };

  memories: {
    getAll: (agentId: string) => Promise<AgentMemory[]>;
    add: (data: NewAgentMemory) => Promise<AgentMemory>;
    update: (id: string, memory: string) => Promise<AgentMemory>;
    delete: (id: string) => Promise<boolean>;
  };
};

export interface NewAgent {
  name: string;
  systemPrompt: string;
  baseAgentId: string;
}

export interface NewAgentMemory {
  agentId: string;
  memory: string;
}
