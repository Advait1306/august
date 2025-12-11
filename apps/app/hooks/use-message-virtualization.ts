import { useMemo, useRef, useEffect } from "react";
import { VListHandle } from "virtua";
import { flattenMessagesToParts } from "@/lib/message-utils";

interface UseMessageVirtualizationProps {
  messages: readonly any[] | null | undefined;
  selectedTaskId: string;
}

export function useMessageVirtualization({
  messages,
  selectedTaskId,
}: UseMessageVirtualizationProps) {
  const virtualizerRef = useRef<VListHandle>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Flatten messages into parts for virtualization
  const messageParts = useMemo(() => {
    return messages ? flattenMessagesToParts(messages, selectedTaskId) : [];
  }, [messages]);

  // Note: This effect may cause a jarring scroll when switching tasks, as it attempts to scroll to the end
  // of the previous task's message list before the new task's messages are loaded. This works for now,
  // but could be improved by checking if messageParts.length > 0 or using a different dependency array.
  useEffect(() => {
    if (virtualizerRef.current) {
      virtualizerRef.current.scrollToIndex(messageParts.length - 1, {
        align: "end",
      });
    }
  }, [selectedTaskId, messages]);

  return {
    messageParts,
    virtualizerRef,
    scrollContainerRef,
  };
}
