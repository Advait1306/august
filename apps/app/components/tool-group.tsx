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
import { motion } from "motion/react";
import { ToolCallPart, ToolResultPart } from "ai";
import { cn } from "@/lib/utils";

const filteredToolNames = ["TodoWrite"];

// Component to render a group of consecutive tools as chips with popovers
export const ToolGroupView = ({
  tools,
}: {
  tools: Array<{
    toolCall: ToolCallPart;
    toolResult: ToolResultPart | undefined;
    partIndex: number;
  }>;
}) => {
  const filteredTools = tools.filter(
    (tool) => !filteredToolNames.includes(tool.toolCall.toolName)
  );

  if (filteredTools.length === 0) {
    return null;
  }

  return (
    <motion.div className="w-full flex gap-2 flex-wrap pb-2" layout>
      {filteredTools.map((tool) => (
        <Popover key={tool.partIndex}>
          <PopoverTrigger asChild>
            <motion.button
              layout
              className={cn(
                "inline-flex items-center justify-center rounded-full",
                "text-sm font-medium",
                "transition-colors hover:bg-card/60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "bg-card border",
                "data-[state=open]:bg-popover"
              )}
            >
              <ToolHeader
                type={`tool-${tool.toolCall.toolName}`}
                state={tool.toolResult ? "output-available" : "input-available"}
              />
            </motion.button>
          </PopoverTrigger>
          <PopoverContent
            className={cn(
              "w-[600px] max-h-[400px] overflow-auto",
              "rounded-xl p-0 bg-background"
            )}
            align="center"
            side="bottom"
          >
            <ToolContent>
              <ToolInput input={tool.toolCall.input} />
              {tool.toolResult && (
                <ToolOutput
                  errorText={undefined}
                  output={tool.toolResult.output}
                />
              )}
            </ToolContent>
          </PopoverContent>
        </Popover>
      ))}
    </motion.div>
  );
};
