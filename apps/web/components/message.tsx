import { Message, MessageContent } from "@/src/components/ai-elements/message";
import { Response } from "@/src/components/ai-elements/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/src/components/ai-elements/tool";
import {
  AssistantContent,
  AssistantModelMessage,
  ToolResultPart,
  UserModelMessage,
} from "ai";

interface UserMessageProps {
  message: UserModelMessage;
}

export const UserMessage = ({ message }: UserMessageProps) => {
  const contents =
    typeof message.content === "string"
      ? [
          <MessageContent className="rounded-3xl">
            {message.content}
          </MessageContent>,
        ]
      : message.content.map((content, index) => {
          switch (content.type) {
            case "text":
              return (
                <MessageContent className="rounded-3xl" key={index}>
                  {content.text}
                </MessageContent>
              );
            case "image":
              return (
                <MessageContent className="rounded-3xl" key={index}>
                  Image not implementd
                </MessageContent>
              );
            case "file":
              return (
                <MessageContent className="rounded-3xl" key={index}>
                  File not implementd
                </MessageContent>
              );
            default:
              return (
                <MessageContent className="rounded-3xl" key={index}>
                  Unknown part type: {content}
                </MessageContent>
              );
          }
        });

  return <Message from="user">{...contents}</Message>;
};

interface AssistantMessageProps {
  message: AssistantModelMessage;
}

export const AssistantMessage = ({ message }: AssistantMessageProps) => {
  if (typeof message.content === "string") {
    return <Response>{message.content}</Response>;
  }

  const parts = message.content as Exclude<AssistantContent, string>;

  const contents = message.content.map((content, index) => {
    switch (content.type) {
      case "text":
        return <Response key={index}>{content.text}</Response>;
      case "tool-call": {
        const result = parts.find(
          (part): part is ToolResultPart =>
            part.type === "tool-result" &&
            part.toolCallId === content.toolCallId
        );

        return (
          <Tool key={index}>
            <ToolHeader
              type={`tool-${content.toolName}`}
              state={result ? "output-available" : "input-available"}
            />
            <ToolContent>
              <ToolInput input={content.input} />
              {result && (
                <ToolOutput errorText={undefined} output={result.output} />
              )}
            </ToolContent>
          </Tool>
        );
      }
      case "tool-result":
        // Skip tool-results as they're taken care of in Tool Call
        break;
      default:
        return <Response key={index}>{JSON.stringify(content)}</Response>;
    }
  });

  return <>{...contents}</>;
};
