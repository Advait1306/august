import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { useTaskRuntime } from "@/src/contexts/task-runtime";
import TaskWindow from "@/components/task-window";

interface TasksProps {
  project?: string;
  agent?: string;
}

export const Route = createFileRoute("/tasks")({
  component: Tasks,
  validateSearch: (search: TasksProps | undefined) => {
    return {
      project: search?.project,
      agent: search?.agent,
    };
  },
});

function Tasks() {
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const { project, agent } = Route.useSearch();

  // Extract URL parameters for pre-selection
  const preselectedProjectId = project;
  const preselectedAgent = agent;

  const focusComposer = () => {
    if (composerInputRef.current) {
      composerInputRef.current.focus();
    }
  };

  const { tasks } = useTaskRuntime();

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] w-full overflow-hidden">
      <div className="flex w-full h-full">
        {/* Thread List Sidebar */}
        <div className="w-1/3 min-w-[300px] border-r border-border bg-[#E8E8E8] dark:bg-[#141414] flex flex-col h-full">
          <div className="p-4 border-b border-border flex-shrink-0">
            <h2 className="text-lg font-semibold">Tasks</h2>
          </div>
          <div className="flex-1 overflow-auto flex flex-col gap-1 p-2">
            {tasks?.map((task: any) => (
              <div
                key={task.id}
                className="h-8 p-2 text-muted-foreground hover:bg-muted rounded-md hover:text-black flex items-center"
              >
                <span className="pointer-events-none select-text">
                  {task.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full">
          <TaskWindow />
        </div>
      </div>
    </div>
  );
}
