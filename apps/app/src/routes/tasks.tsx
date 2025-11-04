import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTaskRuntime } from "@/src/contexts/task-runtime";
import TaskWindow from "@/components/task-window";
import { PlusIcon } from "lucide-react";

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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;

      // Prevent default scrolling behavior
      e.preventDefault();

      // Build array of all selectable item IDs
      const allItemIds: Array<string> = [
        "new-conversation",
        ...(tasks || []).map((t) => t.id),
      ];

      // Find current index
      const currentIndex = allItemIds.indexOf(selectedTaskId);

      // Calculate next index (without wrap-around)
      let nextIndex = currentIndex;
      if (e.key === "ArrowDown") {
        nextIndex = Math.min(currentIndex + 1, allItemIds.length - 1);
      } else {
        nextIndex = Math.max(currentIndex - 1, 0);
      }

      // Only update if index changed
      if (nextIndex !== currentIndex) {
        selectTask(allItemIds[nextIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tasks, selectedTaskId, selectTask]);

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
          <div className="p-4 border-b border-border flex-shrink-0">
            <h2 className="text-lg font-semibold">Tasks</h2>
          </div>
          <div className="flex-1 overflow-auto flex flex-col gap-1 p-2">
            <div
              className="text-sm h-8 p-2 text-muted-foreground hover:bg-muted rounded-md hover:text-foreground flex items-center data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
              data-selected={selectedTaskId === "new-conversation"}
              onClick={() => selectTask("new-conversation")}
            >
              <span className="pointer-events-none select-text flex flex-row items-center gap-2">
                <PlusIcon className="w-4 h-4" /> New Conversation
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
