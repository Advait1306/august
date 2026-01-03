import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { UserModelMessage } from "ai";
import { Separator } from "./ui/separator";

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
                <MessageContent className="rounded-3xl text-sm" key={index}>
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

// Component to render a single user message content for virtualized lists
export const UserMessagePartView = ({ content }: { content: any }) => {
  const contents =
    typeof content === "string"
      ? [
          <MessageContent className="rounded-3xl max-w-[80%]">
            {content}
          </MessageContent>,
        ]
      : content.map((contentPart: any, index: number) => {
          switch (contentPart.type) {
            case "text":
              return (
                <MessageContent className="rounded-3xl max-w-[80%]" key={index}>
                  {contentPart.text}
                </MessageContent>
              );
            case "image":
              return (
                <MessageContent className="rounded-3xl" key={index}>
                  Image not implemented
                </MessageContent>
              );
            case "file":
              return (
                <MessageContent className="rounded-3xl" key={index}>
                  File not implemented
                </MessageContent>
              );
            default:
              return (
                <MessageContent className="rounded-3xl" key={index}>
                  Unknown part type: {contentPart}
                </MessageContent>
              );
          }
        });

  return <Message from="user">{...contents}</Message>;
};

// Component to render assistant text part for virtualized lists
export const AssistantTextPartView = ({ text }: { text: string }) => {
  return (
    <Response
      className="selectable text-sm leading-7 max-w-[80%]"
      components={{
        h1: ({ children }) => (
          <h1 className="text-3xl font-semibold pt-4 pb-1">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-semibold pt-2 pb-1">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold pt-2 pb-1/2">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-semibold pt-2 pb-1/2">{children}</h4>
        ),
        h5: ({ children }) => (
          <h5 className="text-xs font-semibold pt-2 pb-1/2">{children}</h5>
        ),
        h6: ({ children }) => (
          <h6 className="text-xs font-semibold pt-2 pb-1/2">{children}</h6>
        ),
        p: ({ children }) => (
          <p className="text-sm leading-[1.7] -tracking-[0.0125em] pt-1 pb-2">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-5 leading-[1.7]">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-5 leading-[1.7] [&_ol]:list-[lower-alpha] [&_ol_ol]:list-[lower-roman]">
            {children}
          </ol>
        ),
        hr: () => (
          <Separator className="my-5 border-0 h-[1.5px] bg-linear-to-r from-border via-border/70 to-transparent" />
        ),
        pre: ({ children }) => {
          return <pre className="border border-border">{children}</pre>;
        },
        code: ({ children }) => {
          return (
            <code className="text-[0.85em] rounded-sm px-1.5 py-1 mx-1/2 bg-neutral-200 dark:bg-neutral-800">
              {children}
            </code>
          );
        },
      }}
    >
      {text}
    </Response>
  );
};
