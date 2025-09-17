import { useEffect, useState } from "react";
import { useProjectStore } from "@/src/stores/projectStore";
import { Button } from "@/components/ui/button";
import { FolderIcon, Plus } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useCommandMenu } from "@/components/command-menu";
import { createFileRoute } from "@tanstack/react-router";
import { ShellOnly } from "@/components/restrictor";

export const Route = createFileRoute("/projects")({
  component: Projects,
});

function Projects() {
  const { projects, loadProjects, selectNewProject, deleteProject } =
    useProjectStore();
  const { addItemToContext, removeContextItem } = useCommandMenu();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleAddProject = async () => {
    await selectNewProject();
  };

  const handleDeleteProject = async () => {
    if (projectToDelete) {
      await deleteProject(projectToDelete);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const openDeleteDialog = (projectId: string) => {
    setProjectToDelete(projectId);
    setDeleteDialogOpen(true);
  };

  return (
    <ShellOnly>
      <div>
        <div className="flex justify-end p-2">
          <Button
            onClick={handleAddProject}
            variant="outline"
            className="p-0 h-[28px] text-[0.8rem]"
            hotkey="c"
          >
            <FolderIcon className="h-4 w-4" />
            Add Project
          </Button>
        </div>

        <Separator />

        <div className="flex flex-col">
          <div className="p-4 flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <span className="text-muted-foreground">
              Add a project to have an agent work on it.
            </span>
          </div>
          <ul>
            {projects.map((project) => (
              <li
                key={project.id}
                className="first:border-t border-card-border"
              >
                <ContextMenu>
                  <ContextMenuTrigger>
                    <div
                      className="bg-card hover:bg-secondary flex flex-col justify-between border-b border-card-border px-4 py-2 cursor-pointer"
                      onMouseEnter={() =>
                        addItemToContext("project", project.id, project.name, {
                          path: project.path,
                          createdAt: project.createdAt,
                        })
                      }
                      onMouseLeave={() => removeContextItem()}
                    >
                      <div>
                        <h3>{project.name}</h3>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => openDeleteDialog(project.id)}
                    >
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </li>
            ))}
          </ul>
        </div>

        {projects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No projects added yet</p>
            <Button onClick={handleAddProject} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Project
            </Button>
          </div>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                project.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteProject}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ShellOnly>
  );
}
