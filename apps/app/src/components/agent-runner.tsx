import { useEffect, useState } from "react";
import { GitBranch } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { WorkspaceHolder } from "./workspace-holder";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { useWorkspaceStore } from "@/src/stores/workspace-store";
import { useGitStatus } from "@/src/hooks/useGitStatus";
import { cn } from "@/lib/utils";

export function AgentRunner() {
  const {
    workspaces,
    activeWorkspaceId,
    initializeDefaultWorkspace,
    isInitialized,
    openDiffPanels,
    toggleDiffPanel,
  } = useWorkspaceStore();
  const [isReady, setIsReady] = useState(false);

  // Get active workspace cwd for git status check
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const { isGitRepo } = useGitStatus(activeWorkspace?.cwd);

  // Initialize default workspace on first load
  useEffect(() => {
    const initialize = async () => {
      if (!isInitialized) {
        // Fetch home directory and initialize default workspace
        if (window.api?.fileSystem?.getHomeDir) {
          const homeDir = await window.api.fileSystem.getHomeDir();
          initializeDefaultWorkspace(homeDir);
        } else {
          // Fallback if API not available
          initializeDefaultWorkspace("/Users");
        }
      }
      setIsReady(true);
    };
    initialize();
  }, [initializeDefaultWorkspace, isInitialized]);

  // Don't render until initialized
  if (!isReady || workspaces.length === 0) {
    return (
      <div className="h-screen w-full pt-[60px] flex items-center justify-center">
        <div className="text-muted-foreground">Loading workspaces...</div>
      </div>
    );
  }

  const isCurrentPanelOpen = activeWorkspaceId ? openDiffPanels.has(activeWorkspaceId) : false;

  const handleToggleDiff = () => {
    if (activeWorkspaceId) {
      toggleDiffPanel(activeWorkspaceId);
    }
  };

  return (
    <SidebarProvider
      defaultOpen={true}
      style={{ "--header-height": "36px" } as React.CSSProperties}
    >
      <div className="h-screen w-full flex flex-col">
        <header className="h-(--header-height) shrink-0 border-b border-neutral-300 dark:border-neutral-700 bg-neutral-200 dark:bg-[#111111] flex items-center justify-end px-3">
          {isGitRepo && (
            <button
              onClick={handleToggleDiff}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded transition-colors",
                isCurrentPanelOpen
                  ? "bg-neutral-300 dark:bg-neutral-700"
                  : "hover:bg-neutral-300 dark:hover:bg-neutral-700"
              )}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              title="Git Changes (⌘D)"
            >
              <GitBranch className="h-4 w-4" />
            </button>
          )}
        </header>
        <div className="flex flex-1 overflow-hidden">
          <WorkspaceSidebar />
          <SidebarInset className="pr-0 pb-0">
            <div className="flex-1 w-full relative overflow-hidden">
              {workspaces.map((workspace) => {
                const isActive = workspace.id === activeWorkspaceId;
                return (
                  <div
                    key={workspace.id}
                    className="absolute inset-0 h-full w-full"
                    style={{
                      visibility: isActive ? "visible" : "hidden",
                      pointerEvents: isActive ? "auto" : "none",
                      zIndex: isActive ? 1 : 0,
                    }}
                    aria-hidden={!isActive}
                  >
                    <WorkspaceHolder
                      workspaceId={workspace.id}
                      workspaceName={workspace.name}
                      storageKey={`workspace-${workspace.id}`}
                      workspaceCwd={workspace.cwd}
                      isActive={isActive}
                      className="h-full w-full"
                    />
                  </div>
                );
              })}
            </div>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
