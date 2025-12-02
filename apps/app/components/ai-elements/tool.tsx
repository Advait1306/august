import { cn } from "@/lib/utils";
import type { ToolUIPart } from "ai";
import { CheckIcon, CircleIcon, WrenchIcon, XIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";
import { CodeBlock } from "./code-block";
import { Spinner } from "../ui/spinner";
import { motion, type HTMLMotionProps } from "motion/react";

export type ToolProps = ComponentProps<"div">;

export const Tool = ({ className, ...props }: ToolProps) => (
  <div
    className={cn("not-prose mb-4 w-full rounded-md", className)}
    {...props}
  />
);

export type ToolHeaderProps = {
  title?: string;
  type: ToolUIPart["type"];
  state: ToolUIPart["state"];
  className?: string;
};

const getStatusBadge = (status: ToolUIPart["state"]) => {
  const textColors = {
    "input-streaming": "text-white",
    "input-available": "text-white",
    "output-available": "text-black",
    "output-error": "text-white",
  } as const;

  const icons = {
    "input-streaming": <CircleIcon className="size-4" />,
    "input-available": <Spinner className="size-4 animate-spin text-white" />,
    "output-available": <CheckIcon className="size-4 text-green-500" />,
    "output-error": <XIcon className="size-4 text-red-500" />,
  } as const;

  return (
    <motion.div
      className={cn(
        "gap-1.5 rounded-full text-xs",
        textColors[status],
        "opacity-70"
      )}
    >
      {icons[status]}
    </motion.div>
  );
};

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  ...props
}: ToolHeaderProps) => (
  <motion.div
    layout
    className={cn(
      "flex w-full items-center justify-between gap-4 p-0.5 pr-2",
      className
    )}
    {...props}
  >
    <div className="flex items-center gap-2">
      <div className="p-2 rounded-full bg-card-foreground/5">
        <WrenchIcon className="size-3 text-muted-foreground" />
      </div>
      <span className="font-medium text-xs">
        {title ?? type.split("-").slice(1).join("-")}
      </span>
      {getStatusBadge(state)}
    </div>
    {/* <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" /> */}
  </motion.div>
);

export type ToolContentProps = HTMLMotionProps<"div">;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <motion.div
    layout
    className={cn(
      "text-popover-foreground outline-none overflow-hidden",
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolUIPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-2 overflow-hidden p-4", className)} {...props}>
    <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      Parameters
    </h4>
    <div className="rounded-md [&_pre]:!p-0">
      <CodeBlock
        code={JSON.stringify(input, null, 2)}
        language="json"
        className="border-none "
      />
    </div>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolUIPart["output"];
  errorText: ToolUIPart["errorText"];
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  let Output = <div>{output as ReactNode}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = (
      <CodeBlock
        code={JSON.stringify(output, null, 2)}
        language="json"
        className="border-none [&_pre]:!p-0"
      />
    );
  } else if (typeof output === "string") {
    Output = (
      <CodeBlock
        code={output}
        language="json"
        className="border-none [&_pre]:!p-0"
      />
    );
  }

  return (
    <div className={cn("space-y-2 py-4 px-4", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/50 text-foreground"
        )}
      >
        {errorText && <div>{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
