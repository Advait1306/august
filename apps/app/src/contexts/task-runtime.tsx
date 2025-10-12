import { Permission } from "@jupiter/shared/types";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  getAgents,
  getMessages,
  getProjects,
  getTasks,
} from "@jupiter/sync/queries/data";
import { useQuery } from "@rocicorp/zero/react";
import { Agent, Task, Project } from "@jupiter/sync/zero/zero-schema.gen";
import { useSyncContext, useZero } from "../components/sync_engine";
import { nanoid } from "nanoid";
import { AssistantModelMessage, ModelMessage, UserModelMessage } from "ai";

type PermissionState = Record<string, Permission>;
type GenerationState = string[];

type TaskRuntimeState = {
  tasks: Task[];
  selectedTask: any | "new-conversation";
  messages: any;
  selectTask: (task: Task | "new-conversation") => void;
  sendMessage: (message: string) => void;
  composerStates: Record<string, ComposerState>;
  setComposerStates: (states: Record<string, ComposerState>) => void;
  permissions: PermissionState;
  generationState: GenerationState;
};

type ComposerState = {
  prompt: string;
  agent: Agent;
  project: Project;
};

const TaskRuntimeContext = createContext<TaskRuntimeState>({
  tasks: [],
  messages: [],
  selectedTask: "new-conversation",
  selectTask: () => {},
  sendMessage: () => {},
  composerStates: {},
  setComposerStates: () => {},
  permissions: {},
  generationState: [],
});

export const TaskRuntimeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const syncData = useSyncContext();

  const z = useZero();
  const agents = useQuery(getAgents(syncData.authData))[0];
  const projects = useQuery(getProjects(syncData.authData))[0];
  const tasks = useQuery(getTasks(syncData.authData))[0];

  const [composerStates, setComposerStates] = useState<
    Record<string, ComposerState>
  >({});
  const [permissions, setPermissions] = useState<PermissionState>({});
  const alwaysAllowTasks = useRef<string[]>([]);
  const [generationState, setGenerationState] = useState<GenerationState>([]);

  // We need to wait for the task to be created and then select it
  const [waitForSelect, setWaitForSelect] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<any | "new-conversation">(
    "new-conversation"
  );
  const selectedTasksMessages = useQuery(
    getMessages(syncData.authData, selectedTask.id ?? ""),
    { enabled: !!selectedTask.id }
  );

  useEffect(() => {
    // New task is added, select it
    if (waitForSelect) {
      const task = tasks?.find((task) => task.id === waitForSelect);
      if (task) {
        setSelectedTask(task);
        resetNewConversation();
      }
    }
    // Task is either deleted or org is changed and task is lost
    else if (!tasks.map((task) => task.id).includes(selectedTask.id)) {
      setSelectedTask("new-conversation");
      resetNewConversation();
    }
  }, [tasks]);

  useEffect(() => {
    const removeListener = window.api.agent.addPermissionHandler((request) => {
      if (alwaysAllowTasks.current.includes(request.threadId)) {
        window.api.agent.grantPermission(request.id);
        return;
      }

      setPermissions((prev) => ({
        ...prev,
        [request.threadId]: {
          ...request,
          alwaysAllow: () => {
            alwaysAllowTasks.current.push(request.threadId);
            window.api.agent.grantPermission(request.id);
            setPermissions((prev) => {
              const newPermissions = { ...prev };
              delete newPermissions[request.threadId];
              return newPermissions;
            });
          },
          grant: () => {
            window.api.agent.grantPermission(request.id);
            setPermissions((prev) => {
              const newPermissions = { ...prev };
              delete newPermissions[request.threadId];
              return newPermissions;
            });
          },
          deny: () => {
            window.api.agent.denyPermission(request.id);
            setPermissions((prev) => {
              const newPermissions = { ...prev };
              delete newPermissions[request.threadId];
              return newPermissions;
            });
          },
        },
      }));
    });

    return () => {
      removeListener();
    };
  }, []);

  const selectTask = (task: Task | "new-conversation") => {
    setWaitForSelect(null);
    setSelectedTask(task);

    if (task !== "new-conversation") {
      // Composer setup
      let agent = agents.find((agent) => agent.id === task.agent_id);
      let project = projects.find((project) => project.id === task.project_id);

      // TODO (nitpick): If an agent or project name changes once a task is selected,
      // they don't update automatically in the composer
      if (project && agent) {
        // Update composer with the agent and project of selected task
        setComposerStates((prev) => {
          return {
            ...prev,
            [task.id]: {
              ...prev[task.id],
              agent: agent,
              project: project,
            },
          };
        });
      }
    }
  };

  const sendMessage = async (message: string) => {
    // Clear composer prompt
    setComposerStates((prev) => {
      return {
        ...prev,
        [selectedTask.id]: { ...prev[selectedTask.id], prompt: "" },
      };
    });

    let taskId: string;
    let agent: Agent;
    let project: Project;
    let chatMessages: ModelMessage[];

    if (selectedTask === "new-conversation") {
      // Set states
      taskId = nanoid();
      agent = composerStates["new-conversation"]?.agent;
      project = composerStates["new-conversation"]?.project;

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
        project_id: project.id,
        agent_id: agent.id,
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
      taskId = selectedTask.id;
      agent = agents.find((agent) => agent.id === selectedTask.agent_id)!;
      project = projects.find(
        (project) => project.id === selectedTask.project_id
      )!;

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

    // TODO: Message receiving can happen in an async manner,
    // which would allow the listener to survive a reload.
    for await (const reply of window.api.agent.run(
      {
        messages: chatMessages,
        runConfig: {
          project,
        },
        threadId: taskId,
      },
      agent.system_prompt
    )) {
      z.mutate.message.update({
        task_id: taskId,
        message_id: replyId,
        role: reply.role,
        content: reply.content as Record<string, any>[],
        metadata: reply.providerOptions ?? {},
      });
    }

    setGenerationState((prev) => prev.filter((id) => id !== taskId));
  };

  const resetNewConversation = () => {
    setComposerStates((prev) => {
      const newState = { ...prev };
      delete newState["new-conversation"];
      return newState;
    });
  };

  return (
    <TaskRuntimeContext.Provider
      value={{
        tasks,
        selectedTask,
        selectTask,
        messages: selectedTasksMessages[0]?.messages,
        sendMessage,
        composerStates,
        setComposerStates,
        permissions,
        generationState,
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

export const usePermission = (threadId: string): Permission | undefined => {
  const context = useContext(TaskRuntimeContext);

  if (context === undefined)
    throw new Error("usePermission must be used within a TaskRuntimeProvider");

  return context.permissions[threadId];
};
