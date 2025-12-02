import { motion, AnimatePresence } from "motion/react";
import { VList, VListHandle } from "virtua";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { UserMessagePartView, AssistantTextPartView } from "./message";
import { ToolGroupView } from "./tool-group";
import { BlinkingCursor } from "./blinking-cursor";
import { MessagePart } from "@/lib/message-utils";

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
    return (
      <ConversationEmptyState
        icon={<div className="h-[40px] w-[40px] rounded-[20px] bg-primary" />}
        className="-translate-y-1/5"
        title="Start a task"
        description="Share an idea with your artificial helper"
      />
    );
  }

  return (
    <motion.div
      ref={scrollContainerRef}
      layout
      className="relative h-full w-full max-w-[720px]"
    >
      <AnimatePresence>
        <VList className="h-full no-scrollbar w-full" ref={virtualizerRef}>
          {messageParts.map((part) => (
            <motion.div key={part.id} layout layoutId={part.id}>
              {part.type === "user-content" && (
                <UserMessagePartView content={part.content} />
              )}
              {part.type === "assistant-text" && (
                <AssistantTextPartView text={part.text} />
              )}
              {part.type === "tool-group" && (
                <ToolGroupView tools={part.tools} />
              )}
            </motion.div>
          ))}
          {isGenerating && <BlinkingCursor />}
        </VList>
      </AnimatePresence>
    </motion.div>
  );
}
