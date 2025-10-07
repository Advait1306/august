import { Permission } from "@jupiter/shared/types";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getMessages, getTasks } from "@jupiter/sync/queries/data";
import { useQuery } from "@rocicorp/zero/react";
import { useUser } from "@clerk/clerk-react";
import { Task } from "@jupiter/sync/zero/zero-schema.gen";
import { useZero } from "../components/sync_engine";
import { nanoid } from "nanoid";
import { ModelMessage, UserModelMessage } from "ai";
import { Agent } from "../types/agent";
import { Project } from "../types/project";

type PermissionState = Record<string, Permission>;
type GenerationState = Record<string, string>;
// TODO: Create correct type for tasks
type Tasks = any;

type TaskRuntimeState = {
  tasks: Tasks;
  selectedTask: any | "new-conversation";
  messages: any;
  selectTask: (task: Task | "new-conversation") => void;
  sendMessage: (message: string) => void;
  composerStates: Record<string, ComposerState>;
  setComposerStates: (states: Record<string, ComposerState>) => void;
  permissions: PermissionState;
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
});

export const TaskRuntimeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user } = useUser();
  const z = useZero();

  const [composerStates, setComposerStates] = useState<
    Record<string, ComposerState>
  >({});

  const [permissions, setPermissions] = useState<PermissionState>({});
  const alwaysAllowTasks = useRef<string[]>([]);

  // We need to wait for the task to be created and then select it
  const [waitForSelect, setWaitForSelect] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<any | "new-conversation">(
    "new-conversation"
  );

  const data = useQuery(
    getTasks({
      userId: user?.id ?? "no_user_id_available",
    }),
    {
      enabled: !!user?.id,
    }
  );
  const tasks = data[0]?.tasks;

  useEffect(() => {
    if (waitForSelect) {
      const task = tasks?.find((task: Task) => task.id === waitForSelect);
      if (task) {
        setSelectedTask(task);
      }
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

  const selectedTasksMessages = useQuery(
    getMessages(
      { userId: user?.id ?? "no_user_id_available" },
      selectedTask.id ?? ""
    ),
    {
      enabled: !!selectedTask.id,
    }
  );

  const selectTask = (task: Task | "new-conversation") => {
    setWaitForSelect(null);
    setSelectedTask(task);
  };

  const sendMessage = async (message: string) => {
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
      agent = composerStates[taskId]?.agent;
      project = composerStates[taskId]?.project;

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

      chatMessages = [];
      // TODO: Map old messages
      // chatMessages = messages.map((message) => {
      //   return {
      //     role: message.role,
      //     content: message.content ,
      //   };
      // });
    }

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

    for await (const reply of window.api.agent.run(agent.id, {
      messages: chatMessages,
      runConfig: {
        project,
      },
      threadId: taskId,
    })) {
      z.mutate.message.update({
        task_id: taskId,
        message_id: replyId,
        role: reply.role,
        content: reply.content,
        metadata: {},
      });
    }
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
