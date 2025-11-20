import { useState, useEffect, useRef } from "react";
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
import { Agent } from "@jupiter/sync/zero/zero-schema.gen";
import { useSyncContext } from "../src/components/sync_engine";
import { useQuery } from "@rocicorp/zero/react";
import { getAgents } from "@jupiter/sync/queries/data";
import { nanoid } from "nanoid";
import { useZero } from "@/src/hooks/useZero";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { useScrollGradients } from "@/hooks/use-scroll-gradients";

type NewAgent = Omit<
  Agent,
  "id" | "created_at" | "author_id" | "organisation_id"
>;

export function AgentsContent() {
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

  // Scroll gradient hooks
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Derive selected agent from agents array
  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || null;

  const { showTopGradient, showBottomGradient, recalculate } = useScrollGradients(scrollContainerRef);

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

  // Recalculate gradients when agents change
  useEffect(() => {
    recalculate();
  }, [agents, recalculate]);

  return (
    <div className="flex h-full w-full">
      <div className="flex flex-row w-full">
        {/* Agent List Sidebar */}
        <div className="flex-1 min-w-[200px] max-w-[300px] bg-[#E8E8E8] border-r border-border dark:bg-[#141414] flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-2 pt-2">
            <div
              className="text-sm h-8 p-2 text-muted-foreground hover:bg-muted rounded-md hover:text-foreground flex items-center cursor-pointer mb-1"
              onClick={startCreate}
            >
              <span className="pointer-events-none select-text flex flex-row items-center gap-2">
                <Plus className="w-4 h-4" /> New Agent
              </span>
            </div>
          </div>

          {/* Scrollable Agent List with Gradients */}
          <div className="flex-1 relative min-h-0">
            <div
              ref={scrollContainerRef}
              className="absolute inset-0 overflow-auto px-2 flex flex-col gap-1"
            >
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

            {/* Gradient Overlays */}
            {showTopGradient && (
              <div className="absolute top-0 left-0 right-0 h-12 pointer-events-none z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-[#E8E8E8] via-[#E8E8E8]/50 to-transparent dark:from-[#141414] dark:via-[#141414]/50" />
              </div>
            )}
            {showBottomGradient && (
              <div className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none z-10">
                <div className="absolute inset-0 bg-gradient-to-t from-[#E8E8E8] via-[#E8E8E8]/50 to-transparent dark:from-[#141414] dark:via-[#141414]/50" />
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area - Document View/Editor */}
        <div className="relative flex-3 flex flex-col h-full overflow-hidden bg-background pr-6 py-6">
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

          {selectedAgent && (
            <div className="absolute bottom-6 right-6 z-50">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {selectedAgent ? (
            <div className="flex-1 overflow-auto">
              <div className="max-w-3xl mx-auto px-16 py-6">
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
            <motion.div
              className="flex items-center justify-center h-full"
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 2000,
                damping: 300,
              }}
            >
              <Card className="relative w-md h-[400px] overflow-hidden flex justify-end shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] -rotate-2 p-0">
                <img
                  src={"/agent-image-dark.png"}
                  alt="Agents"
                  className="absolute w-full h-full object-cover"
                />

                <div className="relative z-10 rounded-lg overflow-hidden flex flex-col gap-2 pb-4">
                  <CardHeader>
                    <CardTitle className="text-2xl font-medium text-white">
                      What are Agents?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-relaxed pb-2 text-white/80">
                    <p>
                      Agents are customizable AI assistants that you can
                      tailor to your specific workflows and requirements. Each
                      agent is built on a special system prompt that defines
                      its behavior.
                    </p>
                  </CardContent>
                </div>
              </Card>
            </motion.div>
          )}
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
    </div>
  );
}
