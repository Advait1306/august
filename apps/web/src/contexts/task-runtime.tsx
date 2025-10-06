import { Permission } from "@jupiter/shared/types";
import { createContext, useContext, useState } from "react";
import { getMessages, getTasks } from "@jupiter/sync/queries/data";
import { useQuery } from "@rocicorp/zero/react";
import { useUser } from "@clerk/clerk-react";
import { Task } from "@jupiter/sync/zero/zero-schema.gen";

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
};

const TaskRuntimeContext = createContext<TaskRuntimeState>({
  permissions: {},
  generations: {},
  tasks: [],
  messages: [],
  selectedTask: "new-conversation",
  selectTask: () => {},
});

export const TaskRuntimeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user } = useUser();

  const [permissions, setPermissions] = useState<PermissionState>({});
  const [generations, setGenerations] = useState<GenerationState>({});

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

  const selectedTasksMessages = useQuery(
    getMessages(
      { userId: user?.id ?? "no_user_id_available" },
      selectedTask.remote_id ?? ""
    ),
    {
      enabled: !!selectedTask.remote_id,
    }
  );
  console.log(selectedTasksMessages);

  const selectTask = (task: Task | "new-conversation") => {
    setSelectedTask(task);
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
