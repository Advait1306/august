import { useEffect, useState } from "react";
import { useProjectStore } from "@/src/stores/projectStore";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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

export const Route = createFileRoute("/projects")({
  component: Projects,
});

function Projects() {
  const { projects, isLoading, loadProjects, selectNewProject, deleteProject } =
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

  if (isLoading) {
    return <div>Loading projects...</div>;
  }

  return (
    <div>
      <div className="flex justify-end p-2">
        <Button
          onClick={handleAddProject}
          variant="outline"
          className="p-0 h-[28px]"
          hotkey="c"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {projects.map((project) => (
          <ContextMenu key={project.id}>
            <ContextMenuTrigger>
              <div
                className="bg-card flex flex-col justify-between border rounded p-4 hover:shadow-lg transition-shadow cursor-pointer h-32"
                onMouseEnter={() =>
                  addItemToContext("project", project.id, project.name, {
                    path: project.path,
                    createdAt: project.createdAt,
                  })
                }
                onMouseLeave={() => removeContextItem()}
              >
                <div>
                  <h3 className="font-semibold">{project.name}</h3>
                  <p className="text-gray-500 text-xs">{project.path}</p>
                </div>
                <p className="text-gray-400 text-xs mt-2">
                  Created: {new Date(project.createdAt).toLocaleDateString()}
                </p>
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
        ))}
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
  );
}
