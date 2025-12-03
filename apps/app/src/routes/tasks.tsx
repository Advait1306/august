import { createFileRoute } from "@tanstack/react-router";
import TaskWindow from "@/components/task-window";

export const Route = createFileRoute("/tasks")({
  component: Tasks,
});

function Tasks() {
  {
    /* The -10px is to account for the bottom border of the Window */
  }
  return (
    <div className="flex h-[calc(100vh-var(--header-height)-10px)] w-full">
      {/* Main Chat Area - Full Width */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <TaskWindow />
      </div>
    </div>
  );
}
