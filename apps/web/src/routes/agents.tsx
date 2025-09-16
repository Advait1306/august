import { useEffect, useState } from "react";
import { useAgentStore } from "@/src/stores/agentStore";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { NewAgent, Agent } from "@/src/types/agent";
import { createFileRoute } from "@tanstack/react-router";
import { ShellOnly } from "@/components/restrictor";

export const Route = createFileRoute("/agents")({
  component: Agents,
});

function Agents() {
  const {
    agents,
    baseAgents,
    loadAgents,
    loadBaseAgents,
    createAgent,
    updateAgentData,
    deleteAgent,
  } = useAgentStore();

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form states
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);

  // Form data
  const [newAgentForm, setNewAgentForm] = useState<NewAgent>({
    name: "",
    systemPrompt: "",
    baseAgentId: "",
  });
  const [editAgentForm, setEditAgentForm] = useState<Partial<NewAgent>>({});

  useEffect(() => {
    loadAgents();
    loadBaseAgents();
  }, [loadAgents, loadBaseAgents]);

  // Handlers
  const handleCreateAgent = async () => {
    try {
      await createAgent(newAgentForm);
      setShowCreateDialog(false);
      setNewAgentForm({ name: "", systemPrompt: "", baseAgentId: "" });
    } catch (error) {
      console.error("Failed to create agent:", error);
    }
  };

  const handleEditAgent = async () => {
    if (!selectedAgent) return;
    try {
      await updateAgentData(selectedAgent.id, editAgentForm);
      setShowEditDialog(false);
      setSelectedAgent(null);
      setEditAgentForm({});
    } catch (error) {
      console.error("Failed to update agent:", error);
    }
  };

  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;
    try {
      await deleteAgent(agentToDelete);
      setShowDeleteDialog(false);
      setAgentToDelete(null);
    } catch (error) {
      console.error("Failed to delete agent:", error);
    }
  };

  const openEditDialog = (agent: Agent) => {
    setSelectedAgent(agent);
    setEditAgentForm({
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      baseAgentId: agent.baseAgentId,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (agentId: string) => {
    setAgentToDelete(agentId);
    setShowDeleteDialog(true);
  };

  return (
    <ShellOnly>
      <div>
        <div className="flex justify-end p-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
            variant="outline"
            className="p-0 h-[28px] text-[0.8rem]"
            hotkey="c"
          >
            <Plus className="h-4 w-4" />
            Create Agent
          </Button>
        </div>

        <Separator />

        <div className="flex flex-col">
          <div className="p-4 flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
            <span className="text-muted-foreground">
              Create custom agents with your own system prompts.
            </span>
          </div>
          <ul>
            {agents.map((agent) => (
              <li key={agent.id} className="first:border-t border-card-border">
                <ContextMenu>
                  <ContextMenuTrigger>
                    <div className="bg-card hover:bg-secondary flex flex-col justify-between border-b border-card-border px-4 py-2 cursor-pointer">
                      <div>
                        <h3>{agent.name}</h3>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => openEditDialog(agent)}>
                      Edit
                    </ContextMenuItem>
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => openDeleteDialog(agent.id)}
                    >
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </li>
            ))}
          </ul>
        </div>

        {agents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No agents created yet</p>
            <Button onClick={() => setShowCreateDialog(true)} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Agent
            </Button>
          </div>
        )}

        {/* Create Agent Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Create a custom agent with your own system prompt and
                personality.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newAgentForm.name}
                  onChange={(e) =>
                    setNewAgentForm({ ...newAgentForm, name: e.target.value })
                  }
                  placeholder="Enter agent name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="baseAgent">Base Agent</Label>
                <Select
                  value={newAgentForm.baseAgentId}
                  onValueChange={(value) =>
                    setNewAgentForm({ ...newAgentForm, baseAgentId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select base agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseAgents.map((baseAgent) => (
                      <SelectItem key={baseAgent.id} value={baseAgent.id}>
                        {baseAgent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  value={newAgentForm.systemPrompt}
                  onChange={(e) =>
                    setNewAgentForm({
                      ...newAgentForm,
                      systemPrompt: e.target.value,
                    })
                  }
                  placeholder="Enter the system prompt that defines your agent's behavior..."
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateAgent}>Create Agent</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Agent Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Agent</DialogTitle>
              <DialogDescription>
                Modify your agent&apos;s configuration and behavior.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="editName">Name</Label>
                <Input
                  id="editName"
                  value={editAgentForm.name || ""}
                  onChange={(e) =>
                    setEditAgentForm({ ...editAgentForm, name: e.target.value })
                  }
                  placeholder="Enter agent name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editBaseAgent">Base Agent</Label>
                <Select
                  value={editAgentForm.baseAgentId}
                  onValueChange={(value) =>
                    setEditAgentForm({ ...editAgentForm, baseAgentId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select base agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseAgents.map((baseAgent) => (
                      <SelectItem key={baseAgent.id} value={baseAgent.id}>
                        {baseAgent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editSystemPrompt">System Prompt</Label>
                <Textarea
                  id="editSystemPrompt"
                  value={editAgentForm.systemPrompt || ""}
                  onChange={(e) =>
                    setEditAgentForm({
                      ...editAgentForm,
                      systemPrompt: e.target.value,
                    })
                  }
                  placeholder="Enter the system prompt that defines your agent's behavior..."
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleEditAgent}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                agent and all its memories.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAgent}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ShellOnly>
  );
}
