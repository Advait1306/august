import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PencilIcon, Plus, Trash2 } from "lucide-react";
import { useKeyboardNavigation } from "@/src/hooks/useKeyboardNavigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createFileRoute } from "@tanstack/react-router";
import { ShellOnly } from "@/components/restrictor";
import { Agent } from "@jupiter/sync/zero/zero-schema.gen";
import { useSyncContext } from "../components/sync_engine";
import { useQuery } from "@rocicorp/zero/react";
import { getAgents } from "@jupiter/sync/queries/data";
import { nanoid } from "nanoid";
import { useZero } from "@/src/hooks/useZero";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/agents")({
  component: Agents,
});

type NewAgent = Omit<
  Agent,
  "id" | "created_at" | "author_id" | "organisation_id"
>;

function Agents() {
  const z = useZero();
  const syncContext = useSyncContext();

  const agents = useQuery(getAgents(syncContext.authData))[0];

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form states
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [newAgentName, setNewAgentName] = useState("");

  // Local editing state to prevent cursor jumping
  const [localName, setLocalName] = useState("");
  const [localSystemPrompt, setLocalSystemPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Derive selected agent from agents array
  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || null;

  // Sync local state when selected agent changes
  useEffect(() => {
    if (selectedAgent) {
      setLocalName(selectedAgent.name);
      setLocalSystemPrompt(selectedAgent.system_prompt);
    }
  }, [selectedAgent?.id]);

  // Handlers
  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;

    try {
      const agentId = nanoid();

      const result = z.mutate.agents.create({
        agent_id: agentId,
        name: newAgentName,
        system_prompt: "",
        base_agent: "claude-code" as Agent["base_agent"],
      });
      await result.client;

      // Immediately open the newly created agent
      setSelectedAgentId(agentId);

      setShowCreateDialog(false);
      setNewAgentName("");
    } catch (error) {
      console.error("Failed to create agent:", error);
    }
  };

  const handleUpdateAgent = async (updates: Partial<NewAgent>) => {
    if (!selectedAgentId) return;

    try {
      const updateData: {
        agent_id: string;
        name?: string;
        system_prompt?: string;
      } = {
        agent_id: selectedAgentId,
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.system_prompt !== undefined)
        updateData.system_prompt = updates.system_prompt;

      const result = z.mutate.agents.update(updateData);
      await result.client;
    } catch (error) {
      console.error("Failed to update agent:", error);
    }
  };

  const handleDeleteAgent = async () => {
    if (!selectedAgentId) return;

    try {
      // Find the index of the current agent
      const currentIndex = agents.findIndex((a) => a.id === selectedAgentId);

      // Determine which agent to select next
      let nextAgentId: string | null = null;
      if (agents.length > 1) {
        if (currentIndex < agents.length - 1) {
          // Select the next agent
          nextAgentId = agents[currentIndex + 1].id;
        } else if (currentIndex > 0) {
          // If it's the last agent, select the previous one
          nextAgentId = agents[currentIndex - 1].id;
        }
      }

      const result = z.mutate.agents.delete({
        agent_id: selectedAgentId,
      });
      await result.client;

      setSelectedAgentId(nextAgentId);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete agent:", error);
    }
  };

  const startCreate = () => {
    setShowCreateDialog(true);
  };

  // Keyboard navigation with arrow keys
  useKeyboardNavigation({
    items: agents || [],
    selectedId: selectedAgentId || "",
    onSelect: (id) => {
      setSelectedAgentId(id);
    },
    getItemId: (agent) => agent.id,
  });

  // Auto-scroll selected agent into view
  useEffect(() => {
    const selectedElement = document.querySelector('[data-selected="true"]');
    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedAgentId]);

  return (
    <ShellOnly>
      <div className="flex h-[calc(100vh-var(--header-height))] w-full">
        <div className="flex flex-row w-full">
          {/* Agent List Sidebar */}
          <div className="flex-1 min-w-[200px] max-w-[300px] bg-[#E8E8E8] border-r border-border dark:bg-[#141414] flex flex-col">
            <div className="flex-1 overflow-auto flex flex-col gap-1 p-2">
              <div
                className="text-sm h-8 p-2 text-muted-foreground hover:bg-muted rounded-md hover:text-foreground flex items-center cursor-pointer"
                onClick={startCreate}
              >
                <span className="pointer-events-none select-text flex flex-row items-center gap-2">
                  <Plus className="w-4 h-4" /> New Agent
                </span>
              </div>
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="text-sm h-8 p-2 text-muted-foreground hover:bg-muted rounded-md hover:text-foreground flex items-center cursor-pointer data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
                  data-selected={selectedAgentId === agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                >
                  <span className="pointer-events-none select-text line-clamp-1">
                    {agent.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content Area - Document View/Editor */}
          <div className="relative flex-3 flex flex-col h-full overflow-hidden bg-background">
            <div className="w-full absolute top-0 z-50 pt-4 pointer-events-none flex justify-center">
              <AnimatePresence>
                {isEditing && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{
                      type: "spring",
                      stiffness: 1000,
                      damping: 50,
                    }}
                    className="pointer-events-auto"
                  >
                    <Badge variant="default" className="rounded-full gap-2">
                      <PencilIcon className="h-3 w-3" />
                      Changes will be automatically saved
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {agents.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">
                    No agents created yet
                  </p>
                  <Button onClick={startCreate} size="lg">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Agent
                  </Button>
                </div>
              </div>
            ) : selectedAgent ? (
              <div className="flex-1 overflow-auto relative">
                <div className="absolute top-4 right-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="max-w-3xl mx-auto px-16 py-16">
                  <Input
                    value={localName}
                    onChange={(e) => {
                      setLocalName(e.target.value);
                    }}
                    onFocus={() => setIsEditing(true)}
                    onBlur={(e) => {
                      handleUpdateAgent({ name: e.target.value });
                      setIsEditing(false);
                    }}
                    placeholder="Enter agent name"
                    className="!bg-background !text-4xl font-semibold mb-8 border-none px-0 shadow-none focus-visible:ring-0 tracking-tight"
                  />
                  <Textarea
                    value={localSystemPrompt}
                    onChange={(e) => {
                      setLocalSystemPrompt(e.target.value);
                    }}
                    onFocus={() => setIsEditing(true)}
                    onBlur={(e) => {
                      handleUpdateAgent({ system_prompt: e.target.value });
                      setIsEditing(false);
                    }}
                    placeholder="Enter the system prompt that defines your agent's behavior..."
                    className="!bg-background min-h-[300px] resize-none border-none px-0 shadow-none focus-visible:ring-0 !text-base/7 whitespace-pre-wrap text-muted-foreground"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-8">
                <Card className="max-w-md">
                  <CardHeader>
                    <CardTitle>What are Agents?</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground leading-relaxed">
                    <p>
                      Agents are customizable AI assistants that you can tailor
                      to your specific workflows and requirements. Each agent is
                      built on a special system prompt that defines its
                      behavior.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Agent Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent showCloseButton={false}>
          <div className="grid gap-4">
            <Label htmlFor="agentName">Name</Label>
            <Input
              id="agentName"
              value={newAgentName}
              onChange={(e) => setNewAgentName(e.target.value)}
              placeholder="Enter agent name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateAgent();
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setNewAgentName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateAgent}>Create Agent</Button>
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
              agent and all its configuration.
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
    </ShellOnly>
  );
}
