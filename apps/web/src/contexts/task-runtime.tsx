import { Permission } from "@jupiter/shared/types";
import { createContext, useContext, useState } from "react";
import { getTasksAndMessages } from "@jupiter/sync/queries/data";
import { useQuery } from "@rocicorp/zero/react";
import { useUser } from "@clerk/clerk-react";

type PermissionState = Record<string, Permission>;
type GenerationState = Record<string, string>;
// TODO: Create correct type for tasks
type Tasks = any;

type TaskRuntimeState = {
  permissions: PermissionState;
  generations: GenerationState;
  tasks: Tasks;
};

const TaskRuntimeContext = createContext<TaskRuntimeState>({
  permissions: {},
  generations: {},
  tasks: [],
});

export const TaskRuntimeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [permissions, setPermissions] = useState<PermissionState>({});
  const [generations, setGenerations] = useState<GenerationState>({});

  const { user } = useUser();

  const data = useQuery(
    getTasksAndMessages({
      userId: user?.id ?? "no_user_id_available",
    })
  );
  console.log(data);
  const tasks = data[0]?.tasks;

  return (
    <TaskRuntimeContext.Provider value={{ permissions, generations, tasks }}>
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
