import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface DocumentDetailViewProps {
  localName: string;
  setLocalName: (name: string) => void;
  localDescription: string;
  setLocalDescription: (desc: string) => void;
  localContent: string;
  setLocalContent: (content: string) => void;
  setIsEditing: (editing: boolean) => void;
  onUpdateDocument: (
    updates: Partial<{ name: string; content: string; description: string }>
  ) => void;
}

export function DocumentDetailView({
  localName,
  setLocalName,
  localDescription,
  setLocalDescription,
  localContent,
  setLocalContent,
  setIsEditing,
  onUpdateDocument,
}: DocumentDetailViewProps) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-16 py-6">
        {/* Name */}
        <Input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={(e) => {
            onUpdateDocument({ name: e.target.value });
            setIsEditing(false);
          }}
          placeholder="Enter document name"
          className="bg-background! text-4xl! font-semibold mb-4 border-none px-0 shadow-none focus-visible:ring-0 tracking-tight"
        />

        {/* Description */}
        <Textarea
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={(e) => {
            onUpdateDocument({ description: e.target.value });
            setIsEditing(false);
          }}
          placeholder="Enter a brief description of this document..."
          className="bg-background! min-h-[80px] resize-none border-none px-0 shadow-none focus-visible:ring-0 text-base/7! whitespace-pre-wrap text-muted-foreground mb-6"
        />

        {/* Content Section */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Content
          </label>
          <Textarea
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            onFocus={() => setIsEditing(true)}
            onBlur={(e) => {
              onUpdateDocument({ content: e.target.value });
              setIsEditing(false);
            }}
            placeholder="Enter the document content (Markdown supported)..."
            className="bg-muted/30! min-h-[400px] resize-none border border-border rounded-lg p-4 shadow-none focus-visible:ring-1 text-sm! font-mono whitespace-pre-wrap"
          />
        </div>
      </div>
    </div>
  );
}
