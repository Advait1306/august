import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTaskRuntime } from "@/src/contexts/task-runtime";
import TaskWindow from "@/components/task-window";
import { PlusIcon } from "lucide-react";
import { useKeyboardNavigation } from "@/src/hooks/useKeyboardNavigation";

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
  // const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  // const { project, agent } = Route.useSearch();

  // // Extract URL parameters for pre-selection
  // const preselectedProjectId = project;
  // const preselectedAgent = agent;

  // const focusComposer = () => {
  //   if (composerInputRef.current) {
  //     composerInputRef.current.focus();
  //   }
  // };

  const { tasks, selectedTaskId, selectedTask, selectTask } = useTaskRuntime();

  // Keyboard navigation with arrow keys
  useKeyboardNavigation({
    items: tasks || [],
    selectedId: selectedTaskId,
    onSelect: selectTask,
    getItemId: (task) => task.id,
    prependIds: ["new-conversation"],
  });

  // Auto-scroll selected task into view
  useEffect(() => {
    const selectedElement = document.querySelector('[data-selected="true"]');
    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedTask]);

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] w-full">
      <div className="flex flex-row w-full">
        {/* Task List Sidebar */}
        <div className="flex-1 min-w-[200px] max-w-[300px] bg-[#E8E8E8] border-r border-border dark:bg-[#141414] flex flex-col">
          <div className="flex-1 overflow-auto flex flex-col gap-1 p-2">
            <div
              className="text-sm h-8 p-2 text-muted-foreground hover:bg-muted rounded-md hover:text-foreground flex items-center data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
              data-selected={selectedTaskId === "new-conversation"}
              onClick={() => selectTask("new-conversation")}
            >
              <span className="pointer-events-none select-text flex flex-row items-center gap-2">
                <PlusIcon className="w-4 h-4" /> New Task
              </span>
            </div>
            {tasks?.map((task: any) => (
              <div
                key={task.id}
                className="text-sm h-8 p-2 text-muted-foreground hover:bg-muted rounded-md hover:text-foreground flex items-center data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
                data-selected={selectedTaskId === task.id}
                onClick={() => selectTask(task.id)}
              >
                <span className="pointer-events-none select-text line-clamp-1">
                  {task.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-3 flex flex-col h-full overflow-hidden">
          <TaskWindow />
        </div>
      </div>
    </div>
  );
}
