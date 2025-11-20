import * as React from "react";
import {
  Bot,
  Palette,
  Wrench,
  ChevronLeft,
  Wallet,
  PlusIcon,
} from "lucide-react";
import { MCPIcon } from "@/components/icons/MCPIcon";

import { NavMain } from "@/components/nav-main";
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
import { useState, useEffect, useRef } from "react";
import { AgentsContent } from "@/components/agents-content";
import { MCPContent } from "@/components/mcp-content";
import { X } from "lucide-react";
import { useKeyboardNavigation } from "@/src/hooks/useKeyboardNavigation";
import { motion, AnimatePresence } from "motion/react";
import { useScrollGradients } from "@/hooks/use-scroll-gradients";

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
  const [dialog, setDialog] = useState<null | "agents" | "mcp">(null);
  const taskRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleBack = () => {
    const backTo = fromParam || "/tasks";
    navigate({ to: backTo as any });
  };

  // Use scroll gradients hook
  const { showTopGradient, showBottomGradient, recalculate } = useScrollGradients(scrollContainerRef);

  // Scroll selected task into view
  useEffect(() => {
    const selectedElement = taskRefs.current.get(selectedTaskId);
    if (selectedElement) {
      selectedElement.scrollIntoView({
        behavior: "instant",
        block: "nearest",
      });
    }
  }, [selectedTaskId]);

  // Recalculate gradients when tasks or dialog state changes
  useEffect(() => {
    recalculate();
  }, [tasks, dialog, recalculate]);

  // Keyboard navigation for tasks (disabled when dialogs are open)
  useKeyboardNavigation({
    items: dialog ? [] : tasks || [],
    selectedId: selectedTaskId,
    onSelect: (id) => {
      navigate({ to: "/tasks" });
      selectTask(id);
    },
    getItemId: (task) => task.id,
    prependIds: dialog ? [] : ["new-conversation"],
  });

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
                  <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1">
                    TASKS
                  </div>
                  <div
                    ref={(el) => {
                      if (el) {
                        taskRefs.current.set("new-conversation", el);
                      } else {
                        taskRefs.current.delete("new-conversation");
                      }
                    }}
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

                {/* Scrollable Task List with Gradients */}
                <div className="flex-1 relative min-h-0">
                  <div
                    ref={scrollContainerRef}
                    className="absolute inset-0 overflow-auto px-2 flex flex-col gap-1"
                  >
                    {tasks?.map((task: any) => (
                      <div
                        key={task.id}
                        ref={(el) => {
                          if (el) {
                            taskRefs.current.set(task.id, el);
                          } else {
                            taskRefs.current.delete(task.id);
                          }
                        }}
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

                  {/* Gradient Overlays */}
                  {showTopGradient && (
                    <div className="absolute top-0 left-0 right-0 h-12 pointer-events-none z-10">
                      <div className="absolute inset-0 bg-gradient-to-b from-sidebar via-sidebar/50 to-transparent" />
                    </div>
                  )}
                  {showBottomGradient && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none z-10">
                      <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/50 to-transparent" />
                    </div>
                  )}
                </div>
              </div>

              {/* Fixed Bottom Navigation */}
              <div className="flex-shrink-0 flex flex-col gap-1 px-2 pb-2 border-t border-border pt-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start h-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setDialog("agents")}
                >
                  <Bot className="h-4 w-4 mr-2" />
                  Agents
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start h-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setDialog("mcp")}
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

      {/* Dialog Overlay */}
      <AnimatePresence>
        {dialog && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80"
            onClick={() => setDialog(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="relative w-[80%] h-[80%] bg-background border border-border rounded-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="absolute top-6 right-6 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDialog(null)}
                  className="rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="h-full w-full">
                {dialog === "agents" ? <AgentsContent /> : <MCPContent />}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
