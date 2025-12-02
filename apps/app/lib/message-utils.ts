import { AssistantContent, ToolResultPart } from "ai";

// Message part types for virtualization
export type MessagePart =
  | { type: "user-content"; id: string; content: any; messageIndex: number }
  | {
      type: "assistant-text";
      id: string;
      text: string;
      messageIndex: number;
      partIndex: number;
    }
  | {
      type: "tool-group";
      id: string;
      tools: Array<{
        toolCall: any;
        toolResult: ToolResultPart | undefined;
        partIndex: number;
      }>;
      messageIndex: number;
      startPartIndex: number;
    };

// Transform messages into flat list of parts for virtualization
export function flattenMessagesToParts(
  messages: readonly any[],
  selectedTaskId: string
): MessagePart[] {
  const parts: MessagePart[] = [];

  messages.forEach((message, messageIndex) => {
    if (message.role === "user") {
      parts.push({
        type: "user-content",
        id: `${selectedTaskId}-user-${messageIndex}`,
        content: message.content,
        messageIndex,
      });
    } else if (message.role === "assistant") {
      if (typeof message.content === "string") {
        parts.push({
          type: "assistant-text",
          id: `${selectedTaskId}-assistant-${messageIndex}-0`,
          text: message.content,
          messageIndex,
          partIndex: 0,
        });
      } else {
        const contentParts = message.content as Exclude<
          AssistantContent,
          string
        >;

        // Track consecutive tool calls to group them
        let currentToolGroup: Array<{
          toolCall: any;
          toolResult: ToolResultPart | undefined;
          partIndex: number;
        }> = [];
        let toolGroupStartIndex = -1;

        contentParts.forEach((content: any, partIndex: number) => {
          switch (content.type) {
            case "text":
              // If we have accumulated tools, push them as a group first
              if (currentToolGroup.length > 0) {
                parts.push({
                  type: "tool-group",
                  id: `${selectedTaskId}-assistant-${messageIndex}-group-${toolGroupStartIndex}`,
                  tools: currentToolGroup,
                  messageIndex,
                  startPartIndex: toolGroupStartIndex,
                });
                currentToolGroup = [];
                toolGroupStartIndex = -1;
              }

              // Add the text part
              parts.push({
                type: "assistant-text",
                id: `${selectedTaskId}-assistant-${messageIndex}-${partIndex}`,
                text: content.text,
                messageIndex,
                partIndex,
              });
              break;
            case "tool-call": {
              const result = contentParts.find(
                (part): part is ToolResultPart =>
                  part.type === "tool-result" &&
                  part.toolCallId === content.toolCallId
              );

              // Start or continue tool group
              if (currentToolGroup.length === 0) {
                toolGroupStartIndex = partIndex;
              }
              currentToolGroup.push({
                toolCall: content,
                toolResult: result,
                partIndex,
              });
              break;
            }
            case "tool-result":
              // Skip tool-results as they're handled in tool-call
              break;
          }
        });

        // Handle any remaining tools at the end
        if (currentToolGroup.length > 0) {
          parts.push({
            type: "tool-group",
            id: `${selectedTaskId}-assistant-${messageIndex}-group-${toolGroupStartIndex}`,
            tools: currentToolGroup,
            messageIndex,
            startPartIndex: toolGroupStartIndex,
          });
        }
      }
    }
  });

  return parts;
}
