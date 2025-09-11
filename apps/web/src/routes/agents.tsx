import { useEffect, useState } from "react";
import { useAgentStore } from "@/src/stores/agentStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Settings, Trash, Edit } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { NewAgent, BaseAgent, Agent } from "@/src/types/agent";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/agents")({
  component: Agents,
});

function Agents() {
  const {
    agents,
    baseAgents,
    isLoading,
    loadAgents,
    loadBaseAgents,
    createAgent,
    updateAgentData,
    deleteAgent,
    updateBaseAgentApiKey,
  } = useAgentStore();

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);

  // Form states
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedBaseAgent, setSelectedBaseAgent] = useState<BaseAgent | null>(
    null
  );
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);

  // Form data
  const [newAgentForm, setNewAgentForm] = useState<NewAgent>({
    name: "",
    systemPrompt: "",
    baseAgentId: "",
  });
  const [editAgentForm, setEditAgentForm] = useState<Partial<NewAgent>>({});
  const [apiKeyForm, setApiKeyForm] = useState("");

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

  const handleUpdateApiKey = async () => {
    if (!selectedBaseAgent) return;
    try {
      await updateBaseAgentApiKey(selectedBaseAgent.id, apiKeyForm);
      setShowApiKeyDialog(false);
      setSelectedBaseAgent(null);
      setApiKeyForm("");
    } catch (error) {
      console.error("Failed to update API key:", error);
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

  const openApiKeyDialog = (baseAgent: BaseAgent) => {
    setSelectedBaseAgent(baseAgent);
    setApiKeyForm(baseAgent.apiKey || "");
    setShowApiKeyDialog(true);
  };

  if (isLoading) {
    return <div>Loading agents...</div>;
  }

  return (
    <div className="p-6">
      {/* Base Agents Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Base Agents</h2>
        <p className="text-muted-foreground mb-4">
          Foundation agents that provide core functionality. You can only update
          API keys.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {baseAgents.map((baseAgent) => (
            <Card key={baseAgent.id} className="relative">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {baseAgent.name}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openApiKeyDialog(baseAgent)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {baseAgent.apiKey ? "API key configured" : "No API key set"}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Custom Agents Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">Custom Agents</h2>
            <p className="text-muted-foreground">
              Your personalized agents with custom prompts and memories.
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id} className="relative">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {agent.name}
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(agent)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteDialog(agent.id)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="line-clamp-3">
                  {agent.systemPrompt}
                </CardDescription>
                <p className="text-xs text-muted-foreground mt-2">
                  Base:{" "}
                  {baseAgents.find((ba) => ba.id === agent.baseAgentId)?.name ||
                    "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Created: {new Date(agent.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {agents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              No custom agents created yet
            </p>
            <Button onClick={() => setShowCreateDialog(true)} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Agent
            </Button>
          </div>
        )}
      </section>

      {/* Create Agent Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Create a custom agent with your own system prompt and personality.
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
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditAgent}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update API Key</DialogTitle>
            <DialogDescription>
              Configure the API key for {selectedBaseAgent?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKeyForm}
                onChange={(e) => setApiKeyForm(e.target.value)}
                placeholder="Enter API key"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApiKeyDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateApiKey}>Update API Key</Button>
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
  );
}
