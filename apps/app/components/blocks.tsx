import {
  BetaContentBlockParam,
  BetaTextBlockParam,
  BetaToolUseBlockParam,
  BetaThinkingBlockParam,
} from "@anthropic-ai/sdk/resources/beta";
import { Block as BlockType } from "@jupiter/sync/zero/zero-schema.gen";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import {
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

// User text block - renders user message content
export function UserTextBlock({ block }: { block: BlockType }) {
  const content = block.content as BetaContentBlockParam;

  if (content.type === "text") {
    return (
      <Message from="user">
        <MessageContent className="rounded-3xl max-w-[80%]">
          {(content as BetaTextBlockParam).text}
        </MessageContent>
      </Message>
    );
  }

  return (
    <Message from="user">
      <MessageContent className="rounded-3xl">
        Unknown content type: {content.type}
      </MessageContent>
    </Message>
  );
}

// Assistant text block - renders markdown response
export function AssistantTextBlock({ block }: { block: BlockType }) {
  const content = block.content as BetaTextBlockParam;

  return (
    <Response
      className="text-sm leading-7 max-w-[80%]"
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
          <Separator className="my-5 border-0 h-[1.5px] bg-gradient-to-r from-border via-border/70 to-transparent" />
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
      {content.text}
    </Response>
  );
}

// Thinking block - renders Claude's thinking process
export function ThinkingBlock({ block }: { block: BlockType }) {
  const content = block.content as BetaThinkingBlockParam;

  return (
    <div className="text-sm text-muted-foreground italic border-l-2 border-muted-foreground/30 pl-3 my-2">
      <span className="text-xs font-medium text-muted-foreground/70 block mb-1">
        Thinking...
      </span>
      {content.thinking}
    </div>
  );
}

// Tool use block - renders a single tool call as a chip with popover
export function ToolUseBlock({ block }: { block: BlockType }) {
  const content = block.content as BetaToolUseBlockParam;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.button
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            "text-sm font-medium",
            "transition-colors hover:bg-card/60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "bg-background border",
            "data-[state=open]:bg-popover"
          )}
        >
          <ToolHeader
            type={`tool-${content.name}`}
            state={block.complete ? "output-available" : "input-available"}
          />
        </motion.button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-[600px] max-h-[400px] overflow-auto",
          "rounded-xl p-0 bg-popover"
        )}
        align="center"
        side="bottom"
      >
        <ToolContent>
          <ToolInput input={content.input} />
          {block.complete && (
            <ToolOutput errorText={undefined} output={undefined} />
          )}
        </ToolContent>
      </PopoverContent>
    </Popover>
  );
}
