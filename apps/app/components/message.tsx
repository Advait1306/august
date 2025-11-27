import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { UserModelMessage } from "ai";
import { Separator } from "./ui/separator";
import { motion } from "motion/react";

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
          <MessageContent className="rounded-3xl max-w-[80%]" key="0">
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

const MotionResponse = motion.create(Response);

// Component to render assistant text part for virtualized lists
export const AssistantTextPartView = ({ text }: { text: string }) => {
  return (
    <MotionResponse
      layout
      className="text-sm leading-7 max-w-[80%]"
      components={{
        h1: ({ children }) => (
          <motion.h1 className="text-3xl font-semibold pt-4 pb-1" layout>
            {children}
          </motion.h1>
        ),
        h2: ({ children }) => (
          <motion.h2 className="text-xl font-semibold pt-2 pb-1" layout>
            {children}
          </motion.h2>
        ),
        h3: ({ children }) => (
          <motion.h3 className="text-base font-semibold pt-2 pb-1/2" layout>
            {children}
          </motion.h3>
        ),
        h4: ({ children }) => (
          <motion.h4 className="text-sm font-semibold pt-2 pb-1/2" layout>
            {children}
          </motion.h4>
        ),
        h5: ({ children }) => (
          <motion.h5 className="text-xs font-semibold pt-2 pb-1/2" layout>
            {children}
          </motion.h5>
        ),
        h6: ({ children }) => (
          <motion.h6 className="text-xs font-semibold pt-2 pb-1/2" layout>
            {children}
          </motion.h6>
        ),
        p: ({ children }) => (
          <motion.p
            className="text-sm leading-[1.7] -tracking-[0.0125em] pt-1 pb-2"
            layout
          >
            {children}
          </motion.p>
        ),
        ul: ({ children }) => (
          <motion.ul
            className="list-disc list-outside pl-5 leading-[1.7]"
            layout
          >
            {children}
          </motion.ul>
        ),
        ol: ({ children }) => (
          <motion.ol
            className="list-decimal list-outside pl-5 leading-[1.7] [&_ol]:list-[lower-alpha] [&_ol_ol]:list-[lower-roman]"
            layout
          >
            {children}
          </motion.ol>
        ),
        hr: () => (
          <Separator className="my-5 border-0 h-[1.5px] bg-gradient-to-r from-border via-border/70 to-transparent" />
        ),
        pre: ({ children }) => {
          return <pre className="border border-border">{children}</pre>;
        },
        code: ({ children }) => {
          return (
            <motion.code className="text-[0.85em] rounded-sm px-1.5 py-1 mx-1/2 bg-neutral-200 dark:bg-neutral-800">
              {children}
            </motion.code>
          );
        },
      }}
    >
      {text}
    </MotionResponse>
  );
};
