import * as React from "react";
import {
  Bot,
  CheckSquare,
  Palette,
  Wrench,
  ChevronLeft,
  Wallet,
  PlusIcon,
} from "lucide-react";
import { MCPIcon } from "@/components/icons/MCPIcon";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { NavWallet } from "@/components/nav-wallet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { OrganizationSwitcher } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useTaskRuntime } from "@/src/contexts/task-runtime";
import { useState } from "react";
import { AgentsContent } from "@/components/agents-content";
import { MCPContent } from "@/components/mcp-content";
import { X } from "lucide-react";

const data = {
  settingsNav: [
    {
      title: "Appearance",
      url: "/settings/appearance",
      icon: Palette,
    },
    {
      title: "Claude Code",
      url: "/settings/claude-code",
      icon: Wrench,
    },
    {
      title: "Wallet",
      url: "/settings/wallet",
      icon: Wallet,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const navigate = useNavigate();
  const isSettingsPage = location.pathname.startsWith("/settings");
  const fromParam = isSettingsPage ? (location.search as any)?.from : undefined;
  const { tasks, selectedTaskId, selectTask } = useTaskRuntime();
  const [showAgentsDialog, setShowAgentsDialog] = useState(false);
  const [showMCPDialog, setShowMCPDialog] = useState(false);

  const handleBack = () => {
    const backTo = fromParam || "/tasks";
    navigate({ to: backTo as any });
  };

  return (
    <>
      <Sidebar
        className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
        {...props}
      >
        <SidebarHeader>
          {isSettingsPage ? (
            <Button
              variant="ghost"
              className="w-full justify-start m-0 h-7"
              onClick={handleBack}
              hotkey="Escape"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <>
              <OrganizationSwitcher />
              <NavWallet />
            </>
          )}
        </SidebarHeader>
        <SidebarContent>
          {isSettingsPage ? (
            <NavMain items={data.settingsNav} />
          ) : (
            <div className="flex flex-col h-full">
              {/* Tasks Section */}
              <div className="flex flex-col flex-1 min-h-0">
                {/* Fixed Header */}
                <div className="flex-shrink-0 px-2">
                  <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                    TASKS
                  </div>
                  <div
                    className="text-sm h-8 p-2 text-muted-foreground hover:bg-muted rounded-md hover:text-foreground flex items-center data-[selected=true]:bg-muted data-[selected=true]:text-foreground cursor-pointer mb-1"
                    data-selected={selectedTaskId === "new-conversation"}
                    onClick={() => {
                      navigate({ to: "/tasks" });
                      selectTask("new-conversation");
                    }}
                  >
                    <span className="pointer-events-none select-text flex flex-row items-center gap-2">
                      <PlusIcon className="w-4 h-4" /> New Task
                    </span>
                  </div>
                </div>

                {/* Scrollable Task List */}
                <div className="flex-1 overflow-auto px-2 flex flex-col gap-1">
                  {tasks?.map((task: any) => (
                    <div
                      key={task.id}
                      className="text-sm h-8 p-2 text-muted-foreground hover:bg-muted rounded-md hover:text-foreground flex items-center data-[selected=true]:bg-muted data-[selected=true]:text-foreground cursor-pointer"
                      data-selected={selectedTaskId === task.id}
                      onClick={() => {
                        navigate({ to: "/tasks" });
                        selectTask(task.id);
                      }}
                    >
                      <span className="pointer-events-none select-text line-clamp-1">
                        {task.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fixed Bottom Navigation */}
              <div className="flex-shrink-0 flex flex-col gap-1 px-2 pb-2 border-t border-border pt-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start h-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAgentsDialog(true)}
                >
                  <Bot className="h-4 w-4 mr-2" />
                  Agents
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start h-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowMCPDialog(true)}
                >
                  <MCPIcon className="h-4 w-4 mr-2" />
                  MCP
                </Button>
              </div>
            </div>
          )}
        </SidebarContent>
        {!isSettingsPage && (
          <SidebarFooter>
            <NavUser />
          </SidebarFooter>
        )}
      </Sidebar>

      {/* Agents Overlay */}
      {showAgentsDialog && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="absolute top-6 right-6 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAgentsDialog(false)}
              className="rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-full w-full">
            <AgentsContent />
          </div>
        </div>
      )}

      {/* MCP Overlay */}
      {showMCPDialog && (
        <div className="fixed inset-0 z-50 bg-background pt-6 pb-6">
          <div className="absolute top-6 right-6 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMCPDialog(false)}
              className="rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-full w-full">
            <MCPContent />
          </div>
        </div>
      )}
    </>
  );
}
