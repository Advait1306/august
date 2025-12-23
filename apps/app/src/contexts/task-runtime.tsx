import { Permission } from "@jupiter/shared/types";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { queries } from "@jupiter/sync/queries/data";
import { useQuery } from "@rocicorp/zero/react";
import { Agent, Task } from "@jupiter/sync/zero/zero-schema.gen";
import { useZero } from "@/src/hooks/useZero";
import { useRuntimeId } from "@/src/hooks/useRuntimeId";
import { useUser } from "@clerk/clerk-react";
import { mutators } from "@jupiter/sync/mutators/data";
import { useSessionId } from "@/src/hooks/useSessionId";
import { useShellTools } from "@/src/hooks/useShellTools";

type PermissionState = Record<string, Permission[]>;
type PermissionIndexState = Record<string, number>;

type TaskRuntimeState = {
  tasks: Task[];
  selectedTaskId: string | "new-conversation";
  selectedTask: Task | "new-conversation";
  selectTask: (task: string | "new-conversation") => void;
  isGenerating: boolean;
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
  selectedTaskId: "new-conversation",
  selectedTask: "new-conversation",
  selectTask: () => {},
  isGenerating: false,
  sendMessage: () => {},
  stopGeneration: () => {},
  composerStates: {},
  setComposerStates: () => {},
  permissions: {},
  permissionIndices: {},
  nextPermission: () => {},
  previousPermission: () => {},
  defaultCwd: "",
});

export const TaskRuntimeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const z = useZero();
  const { user } = useUser();
  const runtimeId = useRuntimeId(user?.id);
  const sessionId = useSessionId();
  const agents = useQuery(queries.agents.all())[0];
  const tasks = useQuery(queries.tasks.all())[0];

  useShellTools(runtimeId, sessionId);

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
  const [permissionIndices, setPermissionIndices] =
    useState<PermissionIndexState>({});
  const [defaultCwd, setDefaultCwd] = useState<string>("");

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
      : tasks?.find((task) => task.id === selectedTaskId)!;

  const isGenerating = useMemo(() => {
    if (selectedTask === "new-conversation") {
      return false;
    }

    switch (selectedTask.status) {
      case "available":
        return false;
      case "executing":
      case "starting":
      case "stopping":
        return true;
      default:
        return false;
    }
  }, [
    selectedTask === "new-conversation"
      ? "new-conversation"
      : selectedTask.status,
  ]);

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

  const selectTask = (taskId: string | "new-conversation") => {
    setWaitForSelect(null);
    setSelectedTaskId(taskId);
  };

  const stopGeneration = (taskId: string) => {
    z.mutate(
      mutators.tasks.abort({
        task_id: taskId,
      })
    );
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

    if (selectedTaskId === "new-conversation") {
      if (!runtimeId) {
        throw new Error("Runtime ID is required");
      }

      // Set states
      const taskId = crypto.randomUUID();
      const turnId = crypto.randomUUID();
      const blockId = crypto.randomUUID();
      const cwd = composerStates["new-conversation"]?.cwd;

      await z.mutate(
        mutators.tasks.create({
          task_id: taskId,
          turn_id: turnId,
          block_id: blockId,
          message,
          runtime_id: runtimeId,
          session_id: sessionId,
          metadata: cwd ? { cwd } : undefined,
        })
      ).client;

      setWaitForSelect(taskId);
    } else {
      const turnId = crypto.randomUUID();
      const blockId = crypto.randomUUID();

      await z.mutate(
        mutators.message.create({
          task_id: selectedTaskId,
          turn_id: turnId,
          block_id: blockId,
          message,
          session_id: sessionId,
        })
      ).client;
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
        isGenerating,
        sendMessage,
        stopGeneration,
        composerStates,
        setComposerStates,
        permissions,
        permissionIndices,
        nextPermission,
        previousPermission,
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
