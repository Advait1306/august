import { VList, VListHandle } from "virtua";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { UserMessagePartView, AssistantTextPartView } from "./message";
import { ToolGroupView } from "./tool-group";
import { BlinkingCursor } from "./blinking-cursor";
import { MessagePart } from "@/lib/message-utils";
import { EducationCard } from "./education-card";

interface TaskThreadProps {
  selectedTaskId: string;
  messageParts: MessagePart[];
  isGenerating: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  virtualizerRef: React.RefObject<VListHandle | null>;
}

export function TaskThread({
  selectedTaskId,
  messageParts,
  isGenerating,
  scrollContainerRef,
  virtualizerRef,
}: TaskThreadProps) {
  if (selectedTaskId === "new-conversation") {
    {
      /* The -translate-y-20 is to account for optical weight of the composer */
    }
    return (
      <ConversationEmptyState className="flex flex-col justify-center items-center overflow-visible gap-8 p-0 -translate-y-20">
        <div className="w-full max-w-[800px] flex flex-row justify-between items-center gap-2">
          <div className="flex flex-col items-start gap-1">
            <span className="text-xl font-medium text-start">Library</span>
            <span className="text-sm text-muted-foreground max-w-[60%] text-start">
              Learn how to make the best use of August to speed up your work
            </span>
          </div>
          <div className="flex flex-row gap-4 items-center">
            <div className="h-[40px] w-[40px] rounded-full bg-primary" />
          </div>
        </div>
        <div className="relative flex grow-1 max-h-[300px]">
          <div className="absolute w-full h-full pointer-events-none bg-[linear-gradient(90deg,var(--background)_0%,transparent_15%,transparent_90%,var(--background)_100%)]" />
          <div className="w-full max-w-[800px] overflow-x-scroll no-scrollbar">
            <div className="w-fit h-full flex flex-row gap-2 overflow-x-scroll">
              <div className="h-full w-[300px] border rounded-xl overflow-hidden">
                <EducationCard title="Structuring meeting transcripts into tables" />
              </div>
              <div className="h-full w-[300px] border rounded-xl overflow-hidden">
                <EducationCard title="Daily report from Google Sheets and Shiprocket" />
              </div>
              <div className="h-full w-[300px] border rounded-xl overflow-hidden">
                <EducationCard title="Analysing YouTube Analytics data for better videos" />
              </div>
              <div className="h-full w-[300px] border rounded-xl overflow-hidden"></div>
            </div>
          </div>
        </div>
      </ConversationEmptyState>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="relative flex flex-col w-full max-w-[720px] h-[calc(100vh-204px)]"
    >
      <VList className="grow-1 no-scrollbar w-full" ref={virtualizerRef}>
        {/* Used to offset the header */}
        <div className="h-[54px] w-full" />
        {messageParts.map((part) => (
          <div>
            {part.type === "user-content" && (
              <UserMessagePartView content={part.content} />
            )}
            {part.type === "assistant-text" && (
              <AssistantTextPartView text={part.text} />
            )}
            {part.type === "tool-group" && <ToolGroupView tools={part.tools} />}
          </div>
        ))}
        {isGenerating && (
          <div className="flex flex-row text-sm text-muted-foreground items-center gap-2">
            Working...
            <BlinkingCursor />
          </div>
        )}
      </VList>
    </div>
  );
}
