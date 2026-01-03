import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SkillDocument } from "@jupiter/sync/zero/zero-schema.gen";

export interface SkillDetailViewProps {
  documents: SkillDocument[];
  localName: string;
  setLocalName: (name: string) => void;
  localDescription: string;
  setLocalDescription: (desc: string) => void;
  localPrompt: string;
  setLocalPrompt: (prompt: string) => void;
  setIsEditing: (editing: boolean) => void;
  onUpdateSkill: (
    updates: Partial<{ name: string; prompt: string; description: string }>
  ) => void;
  onDocumentClick: (docId: string) => void;
  onAddDocument: () => void;
}

export function SkillDetailView({
  documents,
  localName,
  setLocalName,
  localDescription,
  setLocalDescription,
  localPrompt,
  setLocalPrompt,
  setIsEditing,
  onUpdateSkill,
  onDocumentClick,
  onAddDocument,
}: SkillDetailViewProps) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-16 py-6">
        {/* Name */}
        <Input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={(e) => {
            onUpdateSkill({ name: e.target.value });
            setIsEditing(false);
          }}
          placeholder="Enter skill name"
          className="bg-background! text-4xl! font-semibold mb-4 border-none px-0 shadow-none focus-visible:ring-0 tracking-tight"
        />

        {/* Description */}
        <Textarea
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={(e) => {
            onUpdateSkill({ description: e.target.value });
            setIsEditing(false);
          }}
          placeholder="Enter a brief description of this skill..."
          className="bg-background! min-h-[80px] resize-none border-none px-0 shadow-none focus-visible:ring-0 text-base/7! whitespace-pre-wrap text-muted-foreground mb-6"
        />

        {/* Prompt Section */}
        <div className="mb-8">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Prompt
          </label>
          <Textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            onFocus={() => setIsEditing(true)}
            onBlur={(e) => {
              onUpdateSkill({ prompt: e.target.value });
              setIsEditing(false);
            }}
            placeholder="Enter the system prompt that defines this skill's behavior..."
            className="bg-muted/30! min-h-[200px] resize-none border border-border rounded-lg p-4 shadow-none focus-visible:ring-1 text-sm! font-mono whitespace-pre-wrap"
          />
        </div>

        {/* Documents Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium text-muted-foreground">
              Documents
            </label>
            <Button variant="outline" size="sm" onClick={onAddDocument}>
              <Plus className="w-4 h-4 mr-1" />
              Add Document
            </Button>
          </div>

          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onDocumentClick(doc.id)}
                >
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {doc.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No documents yet</p>
              <p className="text-xs mt-1">
                Add documents to provide additional context for this skill
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
