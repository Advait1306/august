import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Folder, MoreHorizontal, Trash2, Edit2 } from "lucide-react";
import { useWorkspaceStore } from "@/src/stores/workspace-store";
import { AddWorkspaceDialog } from "./add-workspace-dialog";
import { Input } from "@/components/ui/input";

export function WorkspaceSidebar() {
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    deleteWorkspace,
    updateWorkspace,
  } = useWorkspaceStore();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleFinishRename = () => {
    if (editingId && editingName.trim()) {
      updateWorkspace(editingId, { name: editingName.trim() });
    }
    setEditingId(null);
    setEditingName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFinishRename();
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditingName("");
    }
  };

  return (
    <>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarContent>
          <SidebarGroup className="p-0">
            <div className="flex h-[36px] items-center justify-between px-3 border-b border-neutral-300 dark:border-neutral-700">
              <span className="text-xs font-medium text-sidebar-foreground/70">Workspaces</span>
              <button
                title="Add Workspace"
                onClick={() => setIsAddDialogOpen(true)}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-sidebar-accent transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <SidebarGroupContent className="p-2">
              <SidebarMenu>
                {workspaces.map((workspace) => (
                  <SidebarMenuItem key={workspace.id}>
                    {editingId === workspace.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={handleFinishRename}
                        onKeyDown={handleKeyDown}
                        className="h-8 text-sm"
                        autoFocus
                      />
                    ) : (
                      <>
                        <SidebarMenuButton
                          isActive={workspace.id === activeWorkspaceId}
                          onClick={() => setActiveWorkspace(workspace.id)}
                          tooltip={workspace.cwd}
                        >
                          <Folder className="h-4 w-4" />
                          <span>{workspace.name}</span>
                        </SidebarMenuButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuAction showOnHover>
                              <MoreHorizontal className="h-4 w-4" />
                            </SidebarMenuAction>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start">
                            <DropdownMenuItem
                              onClick={() =>
                                handleStartRename(workspace.id, workspace.name)
                              }
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => deleteWorkspace(workspace.id)}
                              disabled={workspaces.length <= 1}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="px-2 py-1 text-xs text-muted-foreground truncate group-data-[collapsible=icon]:hidden">
            {workspaces.find((w) => w.id === activeWorkspaceId)?.cwd}
          </div>
        </SidebarFooter>
      </Sidebar>

      <AddWorkspaceDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />
    </>
  );
}
