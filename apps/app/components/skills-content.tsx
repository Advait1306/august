import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  PencilIcon,
  Plus,
  Trash2,
  Check,
  ChevronLeft,
  FileText,
} from "lucide-react";
import { useKeyboardNavigation } from "@/src/hooks/useKeyboardNavigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useQuery } from "@rocicorp/zero/react";
import { nanoid } from "nanoid";
import { useZero } from "@/src/hooks/useZero";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { useScrollGradients } from "@/hooks/use-scroll-gradients";
import { queries } from "@jupiter/sync/queries/data";
import { mutators } from "@jupiter/sync/mutators/data";
import { SkillDetailView } from "@/components/skill-detail-view";
import { DocumentDetailView } from "@/components/document-detail-view";

type ViewMode = "skills" | "documents";

export function SkillsContent() {
  const z = useZero();

  const [skills] = useQuery(queries.skills.all());

  // View mode and selection states
  const [viewMode, setViewMode] = useState<ViewMode>("skills");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );

  // Creation states
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newItemName, setNewItemName] = useState("");

  // Local editing state to prevent cursor jumping
  const [localName, setLocalName] = useState("");
  const [localDescription, setLocalDescription] = useState("");
  const [localPrompt, setLocalPrompt] = useState("");
  const [localContent, setLocalContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Scroll gradient hooks
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Derive selected skill from skills array
  const selectedSkill = skills.find((s) => s.id === selectedSkillId) || null;

  // Query documents for the selected skill
  const [documents] = useQuery(
    queries.skillDocuments.bySkill({ skillId: selectedSkillId ?? "" }),
    { enabled: !!selectedSkillId }
  );

  // Derive selected document
  const selectedDocument =
    documents?.find((d) => d.id === selectedDocumentId) || null;

  const { showTopGradient, showBottomGradient, recalculate } =
    useScrollGradients(scrollContainerRef);

  // Sync local state when selected skill changes
  useEffect(() => {
    if (selectedSkill && viewMode === "skills") {
      setLocalName(selectedSkill.name);
      setLocalDescription(selectedSkill.description || "");
      setLocalPrompt(selectedSkill.prompt);
    }
  }, [selectedSkill?.id, viewMode]);

  // Sync local state when selected document changes
  useEffect(() => {
    if (selectedDocument && viewMode === "documents") {
      setLocalName(selectedDocument.name);
      setLocalDescription(selectedDocument.description || "");
      setLocalContent(selectedDocument.content);
    }
  }, [selectedDocument?.id, viewMode]);

  // Handlers for Skills
  const handleCreateSkill = async () => {
    if (!newItemName.trim()) return;

    try {
      const skillId = nanoid();

      await z.mutate(
        mutators.skills.create({
          id: skillId,
          name: newItemName,
          prompt: "",
          description: "",
        })
      ).client;

      setSelectedSkillId(skillId);
      setNewItemName("");
      setIsCreatingNew(false);
    } catch (error) {
      console.error("Failed to create skill:", error);
    }
  };

  const handleUpdateSkill = async (
    updates: Partial<{ name: string; prompt: string; description: string }>
  ) => {
    if (!selectedSkillId) return;

    try {
      await z.mutate(
        mutators.skills.update({
          id: selectedSkillId,
          ...updates,
        })
      ).client;
    } catch (error) {
      console.error("Failed to update skill:", error);
    }
  };

  const handleDeleteSkill = async () => {
    if (!selectedSkillId) return;

    try {
      const currentIndex = skills.findIndex((s) => s.id === selectedSkillId);

      let nextSkillId: string | null = null;
      if (skills.length > 1) {
        if (currentIndex < skills.length - 1) {
          nextSkillId = skills[currentIndex + 1].id;
        } else if (currentIndex > 0) {
          nextSkillId = skills[currentIndex - 1].id;
        }
      }

      await z.mutate(
        mutators.skills.delete({
          id: selectedSkillId,
        })
      ).client;

      setSelectedSkillId(nextSkillId);
      setViewMode("skills");
      setSelectedDocumentId(null);
    } catch (error) {
      console.error("Failed to delete skill:", error);
    }
  };

  // Handlers for Documents
  const handleCreateDocument = async () => {
    if (!newItemName.trim() || !selectedSkillId) return;

    try {
      const docId = nanoid();

      await z.mutate(
        mutators.skillDocuments.create({
          id: docId,
          skill_id: selectedSkillId,
          name: newItemName,
          content: "",
          description: "",
        })
      ).client;

      setSelectedDocumentId(docId);
      setViewMode("documents");
      setNewItemName("");
      setIsCreatingNew(false);
    } catch (error) {
      console.error("Failed to create document:", error);
    }
  };

  const handleUpdateDocument = async (
    updates: Partial<{ name: string; content: string; description: string }>
  ) => {
    if (!selectedDocumentId) return;

    try {
      await z.mutate(
        mutators.skillDocuments.update({
          id: selectedDocumentId,
          ...updates,
        })
      ).client;
    } catch (error) {
      console.error("Failed to update document:", error);
    }
  };

  const handleDeleteDocument = async () => {
    if (!selectedDocumentId || !documents) return;

    try {
      const currentIndex = documents.findIndex(
        (d) => d.id === selectedDocumentId
      );

      let nextDocId: string | null = null;
      if (documents.length > 1) {
        if (currentIndex < documents.length - 1) {
          nextDocId = documents[currentIndex + 1].id;
        } else if (currentIndex > 0) {
          nextDocId = documents[currentIndex - 1].id;
        }
      }

      await z.mutate(
        mutators.skillDocuments.delete({
          id: selectedDocumentId,
        })
      ).client;

      if (nextDocId) {
        setSelectedDocumentId(nextDocId);
      } else {
        setViewMode("skills");
        setSelectedDocumentId(null);
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const startCreate = () => {
    setIsCreatingNew(true);
    setNewItemName("");
  };

  const startCreateDocument = () => {
    setViewMode("documents");
    setIsCreatingNew(true);
    setNewItemName("");
  };

  const handleBackToSkill = () => {
    setViewMode("skills");
    setSelectedDocumentId(null);
    if (selectedSkill) {
      setLocalName(selectedSkill.name);
      setLocalDescription(selectedSkill.description || "");
      setLocalPrompt(selectedSkill.prompt);
    }
  };

  // Keyboard navigation for skills
  useKeyboardNavigation({
    items: viewMode === "skills" ? skills : [],
    selectedId: selectedSkillId || "",
    onSelect: (id) => setSelectedSkillId(id),
    getItemId: (item) => item.id,
  });

  // Keyboard navigation for documents
  useKeyboardNavigation({
    items: viewMode === "documents" ? (documents ?? []) : [],
    selectedId: selectedDocumentId || "",
    onSelect: (id) => setSelectedDocumentId(id),
    getItemId: (item) => item.id,
  });

  // Auto-scroll selected item into view
  useEffect(() => {
    const selectedElement = document.querySelector('[data-selected="true"]');
    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedSkillId, selectedDocumentId, viewMode]);

  // Recalculate gradients when items change
  useEffect(() => {
    recalculate();
  }, [skills, documents, viewMode, recalculate]);

  // Get the sidebar items based on view mode
  const sidebarItems = viewMode === "skills" ? skills : documents || [];

  return (
    <div className="flex h-full w-full">
      <div className="flex flex-row w-full">
        {/* Sidebar */}
        <div className="flex-1 min-w-[200px] max-w-[300px] bg-sidebar border-r border-border flex flex-col gap-2 pt-7">
          {/* Fixed Header */}
          <div className="flex flex-col gap-2 shrink-0 px-3 pt-2">
            {viewMode === "documents" && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start -ml-2 text-muted-foreground"
                onClick={handleBackToSkill}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to Skills
              </Button>
            )}

            <Button
              className="grow mt-2"
              size={"sm"}
              onClick={startCreate}
              variant={"outline"}
            >
              <span className="pointer-events-none select-text flex flex-row items-center justify-start gap-2 text-start">
                <Plus className="w-4 h-4" />
                {viewMode === "skills" ? "New Skill" : "New Document"}
              </span>
            </Button>

            {/* Inline New Item Input */}
            {isCreatingNew && (
              <div className="flex items-center gap-1">
                <Input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={
                    viewMode === "skills" ? "Skill name" : "Document name"
                  }
                  className="h-8 text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      viewMode === "skills"
                        ? handleCreateSkill()
                        : handleCreateDocument();
                    } else if (e.key === "Escape") {
                      setIsCreatingNew(false);
                      setNewItemName("");
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={
                    viewMode === "skills"
                      ? handleCreateSkill
                      : handleCreateDocument
                  }
                  disabled={!newItemName.trim()}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Scrollable List with Gradients */}
          <div className="flex-1 relative min-h-0">
            <div
              ref={scrollContainerRef}
              className="absolute inset-0 overflow-auto px-2 flex flex-col gap-1"
            >
              {sidebarItems.map((item) => (
                <div
                  key={item.id}
                  className="text-sm h-8 p-2 text-muted-foreground hover:bg-muted rounded-md hover:text-foreground flex items-center cursor-pointer data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
                  data-selected={
                    viewMode === "skills"
                      ? selectedSkillId === item.id
                      : selectedDocumentId === item.id
                  }
                  onClick={() => {
                    if (viewMode === "skills") {
                      setSelectedSkillId(item.id);
                    } else {
                      setSelectedDocumentId(item.id);
                    }
                  }}
                >
                  {viewMode === "documents" && (
                    <FileText className="w-3 h-3 mr-2 shrink-0" />
                  )}
                  <span className="pointer-events-none select-text line-clamp-1">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Gradient Overlays */}
            {showTopGradient && (
              <div className="absolute top-0 left-0 right-0 h-12 pointer-events-none z-10">
                <div className="absolute inset-0 bg-linear-to-b from-sidebar via-sidebar/50 to-transparent" />
              </div>
            )}
            {showBottomGradient && (
              <div className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none z-10">
                <div className="absolute inset-0 bg-linear-to-t from-sidebar via-sidebar/50 to-transparent" />
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="relative flex-3 flex flex-col h-full overflow-hidden bg-background pr-6 py-6">
          {/* Editing Badge */}
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

          {/* Delete Button */}
          {((viewMode === "skills" && selectedSkill) ||
            (viewMode === "documents" && selectedDocument)) && (
            <div className="absolute bottom-6 right-6 z-50">
              <Popover modal={false}>
                <PopoverAnchor>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                </PopoverAnchor>

                <PopoverContent className="w-80" side="top" align="end">
                  <div className="space-y-4">
                    <p className="text-sm">
                      Are you sure you want to delete this{" "}
                      {viewMode === "skills" ? "skill" : "document"}?
                    </p>
                    <div className="flex gap-2 justify-end">
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          Cancel
                        </Button>
                      </PopoverTrigger>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={
                          viewMode === "skills"
                            ? handleDeleteSkill
                            : handleDeleteDocument
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Content based on view mode */}
          {viewMode === "skills" && selectedSkill ? (
            <SkillDetailView
              documents={documents || []}
              localName={localName}
              setLocalName={setLocalName}
              localDescription={localDescription}
              setLocalDescription={setLocalDescription}
              localPrompt={localPrompt}
              setLocalPrompt={setLocalPrompt}
              setIsEditing={setIsEditing}
              onUpdateSkill={handleUpdateSkill}
              onDocumentClick={(docId) => {
                setSelectedDocumentId(docId);
                setViewMode("documents");
              }}
              onAddDocument={startCreateDocument}
            />
          ) : viewMode === "documents" && selectedDocument ? (
            <DocumentDetailView
              localName={localName}
              setLocalName={setLocalName}
              localDescription={localDescription}
              setLocalDescription={setLocalDescription}
              localContent={localContent}
              setLocalContent={setLocalContent}
              setIsEditing={setIsEditing}
              onUpdateDocument={handleUpdateDocument}
            />
          ) : (
            <EmptyState viewMode={viewMode} />
          )}
        </div>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState({ viewMode }: { viewMode: ViewMode }) {
  return (
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
          alt="Skills"
          className="absolute w-full h-full object-cover"
        />

        <div className="relative z-10 rounded-lg overflow-hidden flex flex-col gap-2 pb-4">
          <CardHeader>
            <CardTitle className="text-2xl font-medium text-white">
              {viewMode === "skills" ? "What are Skills?" : "Select a Document"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed pb-2 text-white/80">
            {viewMode === "skills" ? (
              <p>
                Skills are reusable knowledge modules that enhance your AI
                assistant's capabilities. Each skill contains a prompt and
                supporting documents that provide context for specific domains
                or tasks.
              </p>
            ) : (
              <p>
                Documents provide additional context and reference material for
                a skill. Click on a document from the sidebar to view and edit
                its content.
              </p>
            )}
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}
