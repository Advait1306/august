import { createFileRoute } from "@tanstack/react-router";
import TaskWindow from "@/components/task-window";

export const Route = createFileRoute("/tasks")({
  component: Tasks,
});

function Tasks() {
  return (
    <div className="flex h-[calc(100vh-var(--header-height))] w-full">
      {/* Main Chat Area - Full Width */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <TaskWindow />
      </div>
    </div>
  );
}
