import { IPC, Permission } from "@jupiter/shared/types";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  getAgents,
  getMCPs,
  getMessages,
  getTasks,
} from "@jupiter/sync/queries/data";
import { useQuery } from "@rocicorp/zero/react";
import { Agent, Task, Message } from "@jupiter/sync/zero/zero-schema.gen";
import { useSyncContext } from "@/src/components/sync_engine";
import { useZero } from "@/src/hooks/useZero";
import { nanoid } from "nanoid";
import { AssistantModelMessage, ModelMessage, UserModelMessage } from "ai";
import {
  useSettingsSection,
  type ClaudeInstallation,
} from "@/src/contexts/settings-context";
import { useAuth } from "@clerk/clerk-react";

type PermissionState = Record<string, Permission[]>;
type GenerationState = string[];
type PermissionIndexState = Record<string, number>;

type TaskRuntimeState = {
  tasks: Task[];
  selectedTaskId: string | "new-conversation";
  selectedTask: Task | "new-conversation" | null;
  messages: readonly Message[] | undefined;
  selectTask: (task: string | "new-conversation") => void;
  sendMessage: (message: string) => void;
  stopGeneration: (taskId: string) => void;
  composerStates: Record<string, ComposerState>;
  setComposerStates: (
    states:
      | Record<string, ComposerState>
      | ((prev: Record<string, ComposerState>) => Record<string, ComposerState>)
  ) => void;
  permissions: PermissionState;
  permissionIndices: PermissionIndexState;
  nextPermission: (threadId: string) => void;
  previousPermission: (threadId: string) => void;
  generationState: GenerationState;
  installations: ClaudeInstallation[];
  defaultCwd: string;
};

// Helper function to get default cwd (will be populated async)
const getDefaultCwd = async (): Promise<string> => {
  try {
    return await window.api.projects.getDefaultCwd();
  } catch (error) {
    console.error("Failed to get default cwd:", error);
    return "";
  }
};

type ComposerState = {
  prompt: string;
  agent?: Agent;
  cwd: string;
};

const TaskRuntimeContext = createContext<TaskRuntimeState>({
  tasks: [],
  messages: [],
  selectedTaskId: "new-conversation",
  selectedTask: "new-conversation",
  selectTask: () => {},
  sendMessage: () => {},
  stopGeneration: () => {},
  composerStates: {},
  setComposerStates: () => {},
  permissions: {},
  permissionIndices: {},
  nextPermission: () => {},
  previousPermission: () => {},
  generationState: [],
  installations: [],
  defaultCwd: "",
});

export const TaskRuntimeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const syncData = useSyncContext();
  const { getToken } = useAuth();

  const z = useZero();
  const agents = useQuery(getAgents(syncData.authData))[0];
  const tasks = useQuery(getTasks(syncData.authData))[0];
  const userMcps = useQuery(getMCPs(syncData.authData))[0];

  const [claudeCode, updateClaudeCode] = useSettingsSection("claudeCode");

  const [composerStates, setComposerStates] = useState<
    Record<string, ComposerState>
  >({
    "new-conversation": {
      prompt: "",
      agent: agents[0],
      cwd: "", // This will be set to defaultCwd once it's loaded in the useEffect below
    },
  });
  const [permissions, setPermissions] = useState<PermissionState>({});
  const [permissionIndices, setPermissionIndices] = useState<PermissionIndexState>({});
  const alwaysAllowTasks = useRef<string[]>([]);
  const [generationState, setGenerationState] = useState<GenerationState>([]);
  const [installations, setInstallations] = useState<ClaudeInstallation[]>([]);
  const [defaultCwd, setDefaultCwd] = useState<string>("");

  // Track active agent iterators for cancellation
  const activeIterators = useRef<Record<string, { cancel: () => void }>>({});

  // Load default cwd on mount
  useEffect(() => {
    const loadDefaultCwd = async () => {
      const cwd = await getDefaultCwd();
      setDefaultCwd(cwd);
      setComposerStates((prev) => ({
        ...prev,
        "new-conversation": {
          ...prev["new-conversation"],
          cwd: cwd,
        },
      }));
    };

    loadDefaultCwd();
  }, []);

  // We need to wait for the task to be created and then select it
  const [waitForSelect, setWaitForSelect] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<
    string | "new-conversation"
  >("new-conversation");

  // Derive the selected task from the tasks array
  const selectedTask =
    selectedTaskId === "new-conversation"
      ? "new-conversation"
      : (tasks?.find((task) => task.id === selectedTaskId) ?? null);

  const selectedTasksMessages = useQuery(
    getMessages(
      syncData.authData,
      selectedTaskId === "new-conversation" ? "" : selectedTaskId
    ),
    { enabled: selectedTaskId !== "new-conversation" }
  );

  // Extract cwd from messages when a task is selected
  useEffect(() => {
    if (
      selectedTaskId !== "new-conversation" &&
      selectedTasksMessages[0]?.messages
    ) {
      const messages = selectedTasksMessages[0].messages;

      // Find the last assistant message with metadata
      const lastAssistantMsg = [...messages]
        .reverse()
        .find((msg) => msg.role === "assistant" && msg.metadata);

      if (lastAssistantMsg && lastAssistantMsg.metadata) {
        const metadata = lastAssistantMsg.metadata as any;
        // Check for cwd or old project.path for backward compatibility
        const cwdFromMessages =
          metadata?.claude?.cwd || metadata?.claude?.project?.path || "";

        if (
          cwdFromMessages &&
          selectedTask &&
          typeof selectedTask === "object"
        ) {
          const agent = agents.find(
            (agent) => agent.id === selectedTask.agent_id
          );

          if (agent) {
            setComposerStates((prev) => {
              return {
                ...prev,
                [selectedTask.id]: {
                  ...prev[selectedTask.id],
                  agent: agent,
                  cwd: cwdFromMessages,
                },
              };
            });
          }
        }
      }
    }
  }, [selectedTaskId, selectedTasksMessages, selectedTask, agents]);

  // Load Claude Code installations on mount
  useEffect(() => {
    const loadInstallations = async () => {
      try {
        const discovered = await window.api.claudeCode.discoverInstallations();
        setInstallations(discovered);
      } catch (error) {
        console.error("Failed to discover Claude Code installations:", error);
      }
    };

    loadInstallations();
  }, []);

  // Ensure Claude Code installation is configured
  useEffect(() => {
    // Check if installation is already set
    if (claudeCode.selectedInstallation || installations.length === 0) {
      return;
    }

    // Prefer bundled installation, otherwise use the first available
    const bundledInstallation = installations.find(
      (install) => install.source === "bundled"
    );
    const defaultInstallation = bundledInstallation || installations[0];

    // Set the default installation
    updateClaudeCode({ selectedInstallation: defaultInstallation });
  }, [installations, claudeCode.selectedInstallation, updateClaudeCode]);

  useEffect(() => {
    // New task is added, select it
    if (waitForSelect) {
      const task = tasks?.find((task) => task.id === waitForSelect);
      if (task) {
        setSelectedTaskId(task.id);
        resetNewConversation();
      }
    }
    // Task is either deleted or org is changed and task is lost
    else if (
      selectedTaskId !== "new-conversation" &&
      !tasks.map((task) => task.id).includes(selectedTaskId)
    ) {
      setSelectedTaskId("new-conversation");
      resetNewConversation();
    }
  }, [tasks, selectedTaskId, waitForSelect]);

  useEffect(() => {
    const removeListener = window.api.agent.addPermissionHandler((request) => {
      if (alwaysAllowTasks.current.includes(request.threadId)) {
        window.api.agent.grantPermission(request.id);
        return;
      }

      setPermissions((prev) => {
        const existingPermissions = prev[request.threadId] || [];
        const isFirstPermission = existingPermissions.length === 0;

        // Initialize index for first permission
        if (isFirstPermission) {
          setPermissionIndices((prevIndices) => ({
            ...prevIndices,
            [request.threadId]: 0,
          }));
        }

        return {
          ...prev,
          [request.threadId]: [
            ...existingPermissions,
            {
              ...request,
              alwaysAllow: () => {
                alwaysAllowTasks.current.push(request.threadId);
                // Grant all pending permissions for this thread
                setPermissions((current) => {
                  const threadPermissions = current[request.threadId] || [];
                  threadPermissions.forEach((perm) => {
                    window.api.agent.grantPermission(perm.id);
                  });
                  const newPermissions = { ...current };
                  delete newPermissions[request.threadId];
                  return newPermissions;
                });
                // Clear permission index
                setPermissionIndices((prevIndices) => {
                  const newIndices = { ...prevIndices };
                  delete newIndices[request.threadId];
                  return newIndices;
                });
              },
              grant: () => {
                window.api.agent.grantPermission(request.id);
                setPermissions((current) => {
                  const threadPermissions = current[request.threadId] || [];
                  const updatedPermissions = threadPermissions.filter(
                    (perm) => perm.id !== request.id
                  );
                  const newPermissions = { ...current };
                  if (updatedPermissions.length === 0) {
                    delete newPermissions[request.threadId];
                  } else {
                    newPermissions[request.threadId] = updatedPermissions;
                  }
                  return newPermissions;
                });
                // Adjust index if needed
                setPermissionIndices((prevIndices) => {
                  const threadPermissions = permissions[request.threadId] || [];
                  const currentIndex = prevIndices[request.threadId] || 0;
                  const updatedPermissions = threadPermissions.filter(
                    (perm) => perm.id !== request.id
                  );

                  if (updatedPermissions.length === 0) {
                    const newIndices = { ...prevIndices };
                    delete newIndices[request.threadId];
                    return newIndices;
                  } else if (currentIndex >= updatedPermissions.length) {
                    return {
                      ...prevIndices,
                      [request.threadId]: updatedPermissions.length - 1,
                    };
                  }
                  return prevIndices;
                });
              },
              deny: () => {
                window.api.agent.denyPermission(request.id);
                setPermissions((current) => {
                  const threadPermissions = current[request.threadId] || [];
                  const updatedPermissions = threadPermissions.filter(
                    (perm) => perm.id !== request.id
                  );
                  const newPermissions = { ...current };
                  if (updatedPermissions.length === 0) {
                    delete newPermissions[request.threadId];
                  } else {
                    newPermissions[request.threadId] = updatedPermissions;
                  }
                  return newPermissions;
                });
                // Adjust index if needed
                setPermissionIndices((prevIndices) => {
                  const threadPermissions = permissions[request.threadId] || [];
                  const currentIndex = prevIndices[request.threadId] || 0;
                  const updatedPermissions = threadPermissions.filter(
                    (perm) => perm.id !== request.id
                  );

                  if (updatedPermissions.length === 0) {
                    const newIndices = { ...prevIndices };
                    delete newIndices[request.threadId];
                    return newIndices;
                  } else if (currentIndex >= updatedPermissions.length) {
                    return {
                      ...prevIndices,
                      [request.threadId]: updatedPermissions.length - 1,
                    };
                  }
                  return prevIndices;
                });
              },
            },
          ],
        };
      });
    });

    return () => {
      removeListener();
    };
  }, []);

  const selectTask = (taskId: string | "new-conversation") => {
    setWaitForSelect(null);
    setSelectedTaskId(taskId);
  };

  const stopGeneration = (taskId: string) => {
    const iterator = activeIterators.current[taskId];
    if (iterator) {
      iterator.cancel();
      delete activeIterators.current[taskId];
      setGenerationState((prev) => prev.filter((id) => id !== taskId));

      // Clear all pending permissions for this task without denying them
      setPermissions((prev) => {
        const newPermissions = { ...prev };
        delete newPermissions[taskId];
        return newPermissions;
      });

      // Clear permission index
      setPermissionIndices((prev) => {
        const newIndices = { ...prev };
        delete newIndices[taskId];
        return newIndices;
      });
    }
  };

  const nextPermission = (threadId: string) => {
    setPermissionIndices((prev) => {
      const threadPermissions = permissions[threadId] || [];
      if (threadPermissions.length === 0) return prev;

      const currentIndex = prev[threadId] || 0;
      // Don't wrap around - stop at the end
      if (currentIndex >= threadPermissions.length - 1) return prev;

      const nextIndex = currentIndex + 1;

      return {
        ...prev,
        [threadId]: nextIndex,
      };
    });
  };

  const previousPermission = (threadId: string) => {
    setPermissionIndices((prev) => {
      const threadPermissions = permissions[threadId] || [];
      if (threadPermissions.length === 0) return prev;

      const currentIndex = prev[threadId] || 0;
      // Don't wrap around - stop at the beginning
      if (currentIndex === 0) return prev;

      const previousIndex = currentIndex - 1;

      return {
        ...prev,
        [threadId]: previousIndex,
      };
    });
  };

  const sendMessage = async (message: string) => {
    setComposerStates((prev) => {
      return {
        ...prev,
        [selectedTaskId]: { ...prev[selectedTaskId], prompt: "" },
      };
    });

    let taskId: string;
    let agent: Agent | undefined;
    let cwd: string;
    let chatMessages: ModelMessage[];

    if (selectedTaskId === "new-conversation") {
      // Set states
      taskId = nanoid();
      agent = composerStates["new-conversation"]?.agent;
      cwd = composerStates["new-conversation"]?.cwd;

      // Create task with first message
      const messageId = nanoid();
      const m = {
        role: "user",
        content: [{ type: "text", text: message }],
      } as UserModelMessage;

      chatMessages = [m];

      // Create new task
      const result = z.mutate.tasks.create({
        task_id: taskId,
        ...(agent && { agent_id: agent.id }),
        message_data: {
          task_id: taskId,
          message_id: messageId,
          role: m.role,
          content: m.content as Record<string, any>[],
          metadata: {},
        },
      });

      await result.client;

      setWaitForSelect(taskId);
    } else {
      // Set states
      taskId = selectedTaskId;
      const currentTask = tasks?.find((t) => t.id === selectedTaskId);
      if (!currentTask) {
        throw new Error("Selected task not found");
      }
      agent = currentTask.agent_id
        ? agents.find((agent) => agent.id === currentTask.agent_id)
        : undefined;
      cwd = composerStates[selectedTaskId]?.cwd || defaultCwd;

      // Create message
      const messageId = nanoid();
      const m = {
        role: "user",
        content: [{ type: "text", text: message }],
      } as UserModelMessage;

      let res = z.mutate.message.create({
        task_id: taskId,
        message_id: messageId,
        role: m.role,
        content: m.content as Record<string, any>[],
        metadata: {},
      });

      await res.client;

      const messages = await z.query.messages
        .where("task_id", taskId)
        .orderBy("created_at", "asc")
        .run();

      chatMessages = messages.map((message) => {
        if (message.role === "user") {
          return {
            role: "user",
            content: message.content as Record<string, any>[],
            providerOptions: message.metadata as Record<string, any>,
          } as UserModelMessage;
        } else if (message.role === "assistant") {
          return {
            role: "assistant",
            content: message.content as Record<string, any>[],
            providerOptions: message.metadata as Record<string, any>,
          } as AssistantModelMessage;
        } else {
          // Fallback for unexpected roles
          return {
            role: message.role,
            content: message.content as Record<string, any>[],
            providerOptions: message.metadata as Record<string, any>,
          } as ModelMessage;
        }
      });
    }

    setGenerationState((prev) => [...prev, taskId]);
    const replyId = nanoid();
    // We have to create and update our message
    // instead of using an upsert transaction because
    // upsert seems to delete the row and add a new one
    // which causes layout shifts.
    const result = z.mutate.message.create({
      task_id: taskId,
      message_id: replyId,
      role: "assistant",
      content: [],
      metadata: {},
    });

    await result.client;

    const token = await getToken({
      template: "cc-proxy",
      skipCache: true,
    });

    if (!token) {
      throw new Error("Failed to get token");
    }

    // Create agent iterator and store it for cancellation
    const agentIterator = window.api.agent.run({
      options: {
        messages: chatMessages,
        runConfig: {
          cwd,
        },
        threadId: taskId,
      },
      systemPrompt: agent?.system_prompt,
      path: claudeCode.selectedInstallation?.path,
      mcpServers: userMcps.reduce(
        (acc, mcp) => {
          acc[mcp.name] = {
            type: "http",
            url: `${import.meta.env.VITE_SERVER_URL}/proxy/mcp/${mcp.id}/`,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          };
          return acc;
        },
        {} as NonNullable<IPC.Agent.RunRequest["mcpServers"]>
      ),
      env:
        claudeCode.selectedInstallation?.source === "bundled"
          ? {
              ANTHROPIC_BASE_URL: `${import.meta.env.VITE_SERVER_URL}/cc-proxy`,
              ANTHROPIC_API_KEY: token,
            }
          : undefined,
      ...(claudeCode.inheritUserSettings &&
        claudeCode.selectedInstallation?.source !== "bundled" && {
          settingSources: ["user"],
        }),
    });

    // Store the iterator for cancellation
    activeIterators.current[taskId] = agentIterator;

    try {
      for await (const reply of agentIterator) {
        z.mutate.message.update({
          task_id: taskId,
          message_id: replyId,
          role: reply.role,
          content: reply.content as Record<string, any>[],
          metadata: reply.providerOptions ?? {},
        });
      }
    } finally {
      // Clean up the iterator reference and generation state
      delete activeIterators.current[taskId];
      setGenerationState((prev) => prev.filter((id) => id !== taskId));
    }
  };

  const resetNewConversation = () => {
    setComposerStates((prev) => {
      const newState = { ...prev };
      newState["new-conversation"] = {
        prompt: "",
        agent: undefined,
        cwd: defaultCwd,
      };
      return newState;
    });
  };

  return (
    <TaskRuntimeContext.Provider
      value={{
        tasks,
        selectedTaskId,
        selectedTask,
        selectTask,
        messages: selectedTasksMessages[0]?.messages,
        sendMessage,
        stopGeneration,
        composerStates,
        setComposerStates,
        permissions,
        permissionIndices,
        nextPermission,
        previousPermission,
        generationState,
        installations,
        defaultCwd,
      }}
    >
      {children}
    </TaskRuntimeContext.Provider>
  );
};

export const useTaskRuntime = () => {
  const context = useContext(TaskRuntimeContext);
  if (context === undefined) {
    throw new Error("useTaskRuntime must be used within a TaskRuntimeProvider");
  }
  return context;
};

export const usePermission = (threadId: string): Permission[] => {
  const context = useContext(TaskRuntimeContext);

  if (context === undefined)
    throw new Error("usePermission must be used within a TaskRuntimeProvider");

  return context.permissions[threadId] || [];
};

export const useClaudeCodeInstallations = (): ClaudeInstallation[] => {
  const context = useContext(TaskRuntimeContext);

  if (context === undefined)
    throw new Error(
      "useClaudeCodeInstallations must be used within a TaskRuntimeProvider"
    );

  return context.installations;
};
