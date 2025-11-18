import { createFileRoute } from "@tanstack/react-router";
import TaskWindow from "@/components/task-window";

export const Route = createFileRoute("/tasks")({
  component: Tasks,
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

  // Keyboard navigation is now handled in the sidebar

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] w-full">
      {/* Main Chat Area - Full Width */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <TaskWindow />
      </div>
    </div>
  );
}
