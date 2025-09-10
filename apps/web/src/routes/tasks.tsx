import { RuntimeProvider } from "../stores/conversationStore";
import { Thread } from "@/components/assistant-ui/thread";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";

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

export default function Tasks() {
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

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] w-full overflow-hidden">
      <RuntimeProvider>
        <div className="flex w-full h-full">
          {/* Thread List Sidebar */}
          <div className="w-1/3 min-w-[300px] border-r border-border bg-muted/10 flex flex-col h-full">
            <div className="p-4 border-b border-border flex-shrink-0">
              <h2 className="text-lg font-semibold">Tasks</h2>
            </div>
            <div className="flex-1 overflow-auto">
              <ThreadList onNewTask={focusComposer} />
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col h-full">
            <Thread
              composerInputRef={composerInputRef}
              preselectedProjectId={preselectedProjectId}
              preselectedAgent={preselectedAgent}
            />
          </div>
        </div>
      </RuntimeProvider>
    </div>
  );
}
