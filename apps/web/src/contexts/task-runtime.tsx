import { Permission } from "@jupiter/shared/types";
import { createContext, useContext, useEffect, useState } from "react";
import { getMessages, getTasks } from "@jupiter/sync/queries/data";
import { useQuery } from "@rocicorp/zero/react";
import { useUser } from "@clerk/clerk-react";
import { Schema, Task } from "@jupiter/sync/zero/zero-schema.gen";
import { useZero } from "../routes/sync_engine";
import { nanoid } from "nanoid";
import { UserModelMessage } from "ai";

type PermissionState = Record<string, Permission>;
type GenerationState = Record<string, string>;
// TODO: Create correct type for tasks
type Tasks = any;

type TaskRuntimeState = {
  permissions: PermissionState;
  generations: GenerationState;
  tasks: Tasks;
  selectedTask: any | "new-conversation";
  messages: any;
  selectTask: (task: Task | "new-conversation") => void;
  sendMessage: (message: string) => void;
};

const TaskRuntimeContext = createContext<TaskRuntimeState>({
  permissions: {},
  generations: {},
  tasks: [],
  messages: [],
  selectedTask: "new-conversation",
  selectTask: () => {},
  sendMessage: () => {},
});

export const TaskRuntimeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user } = useUser();
  const z = useZero();

  const [permissions, setPermissions] = useState<PermissionState>({});
  const [generations, setGenerations] = useState<GenerationState>({});

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
    if (selectedTask === "new-conversation") {
      const taskId = nanoid();
      const messageId = nanoid();
      const m = {
        role: "user",
        content: [{ type: "text", text: message }],
      } as UserModelMessage;

      // Create new task
      z.mutate.tasks.create({
        task_id: taskId,
        message_data: {
          task_id: taskId,
          message_id: messageId,
          role: m.role,
          content: m.content as Record<string, any>[],
          metadata: {},
        },
      });

      setWaitForSelect(taskId);
    } else {
      const messageId = nanoid();
      const m = {
        role: "user",
        content: [{ type: "text", text: message }],
      } as UserModelMessage;

      z.mutate.message.upsert({
        task_id: selectedTask.id,
        message_id: messageId,
        role: m.role,
        content: m.content as Record<string, any>[],
        metadata: {},
      });
    }
  };

  return (
    <TaskRuntimeContext.Provider
      value={{
        permissions,
        generations,
        tasks,
        selectedTask,
        selectTask,
        messages: selectedTasksMessages[0]?.messages,
        sendMessage,
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
