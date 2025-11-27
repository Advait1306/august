import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  ToolGroupTabs,
  ToolGroupTabsContent,
  ToolGroupTabsList,
  ToolGroupTabsTrigger,
} from "@/components/ui/tool-group-tabs";
import { AnimatePresence, AnimateSharedLayout, motion } from "motion/react";
import { ToolCallPart, ToolResultPart } from "ai";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Component to render a group of consecutive tools horizontally
export const ToolGroupView = ({
  tools,
}: {
  tools: Array<{
    toolCall: ToolCallPart;
    toolResult: ToolResultPart | undefined;
    partIndex: number;
  }>;
}) => {
  const [selectedId, setSelectedId] = useState<string>("");

  return (
    <ToolGroupTabs value={selectedId} asChild={true}>
      <motion.div className="w-full" layout>
        <ToolGroupTabsList>
          {tools.map((tool) => {
            const toolValue = `tool-${tool.partIndex}`;
            const isSelected = selectedId === toolValue;
            return (
              <ToolGroupTabsTrigger
                key={tool.partIndex}
                value={toolValue}
                isSelected={isSelected}
                onClick={(e) => {
                  // Toggle: if clicking the currently selected tab, deselect it
                  if (isSelected) {
                    e.preventDefault();
                    setSelectedId("");
                  } else {
                    setSelectedId(toolValue);
                  }
                }}
              >
                <ToolHeader
                  type={`tool-${tool.toolCall.toolName}`}
                  state={
                    tool.toolResult ? "output-available" : "input-available"
                  }
                />
              </ToolGroupTabsTrigger>
            );
          })}
        </ToolGroupTabsList>

        <AnimatePresence>
          {selectedId && (
            <motion.div
              layout
              className={cn(
                "flex-1 outline-none relative overflow-hidden bg-accent"
              )}
              initial={{ height: 0 }}
              animate={{ height: "400px" }}
              layoutId="tool-group-tabs-content"
              id="tool-group-tabs-content"
              key="tool-group-tabs-content"
            >
              {tools.map((tool) => (
                <ToolGroupTabsContent
                  key={tool.partIndex}
                  value={`tool-${tool.partIndex}`}
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
                </ToolGroupTabsContent>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </ToolGroupTabs>
  );
};
