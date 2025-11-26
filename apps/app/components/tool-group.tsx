import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { ToolCallPart, ToolResultPart } from "ai";

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
  return (
    <div className="flex gap-2 overflow-x-auto w-full">
      {tools.map((tool) => (
        <Tool
          key={tool.partIndex}
          className="rounded-2xl bg-accent flex-shrink-0 min-w-[300px] max-w-[400px]"
        >
          <ToolHeader
            type={`tool-${tool.toolCall.toolName}`}
            state={tool.toolResult ? "output-available" : "input-available"}
          />
          <ToolContent>
            <ToolInput input={tool.toolCall.input} />
            {tool.toolResult && (
              <ToolOutput errorText={undefined} output={tool.toolResult.output} />
            )}
          </ToolContent>
        </Tool>
      ))}      
    </div>
  );
};
