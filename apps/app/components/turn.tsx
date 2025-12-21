import { useQuery } from "@rocicorp/zero/react";
import { queries } from "@jupiter/sync/queries/data";
import {
  BetaContentBlockParam,
  BetaToolUseBlockParam,
} from "@anthropic-ai/sdk/resources/beta";
import { Turn as TurnType, Block as BlockType } from "@jupiter/sync/zero/zero-schema.gen";
import {
  UserTextBlock,
  AssistantTextBlock,
  ThinkingBlock,
  ToolUseBlock,
} from "./blocks";

interface TurnProps {
  turn: TurnType;
}

const FILTERED_TOOL_NAMES = ["TodoWrite"];

export function Turn({ turn }: TurnProps) {
  // Fetch blocks for this turn
  const [blocks] = useQuery(queries.blocks.byTurn({ turnId: turn.id }));

  // Render based on turn type
  if (turn.type === "user") {
    return <UserTurn blocks={blocks as BlockType[]} />;
  }

  return <AssistantTurn blocks={blocks as BlockType[]} />;
}

function UserTurn({ blocks }: { blocks: BlockType[] }) {
  return (
    <>
      {blocks.map((block) => (
        <UserTextBlock key={block.id} block={block} />
      ))}
    </>
  );
}

function AssistantTurn({ blocks }: { blocks: BlockType[] }) {
  const elements: React.ReactNode[] = [];
  let toolGroup: BlockType[] = [];

  const flushToolGroup = () => {
    if (toolGroup.length > 0) {
      elements.push(
        <div key={`tool-group-${toolGroup[0].id}`} className="w-full flex gap-2 flex-wrap pb-2">
          {toolGroup.map((block) => (
            <ToolUseBlock key={block.id} block={block} />
          ))}
        </div>
      );
      toolGroup = [];
    }
  };

  blocks.forEach((block) => {
    const content = block.content as BetaContentBlockParam;

    if (content.type === "tool_use") {
      // Filter out certain tools
      const toolContent = content as BetaToolUseBlockParam;
      if (!FILTERED_TOOL_NAMES.includes(toolContent.name)) {
        toolGroup.push(block);
      }
    } else {
      flushToolGroup();

      if (content.type === "text") {
        elements.push(<AssistantTextBlock key={block.id} block={block} />);
      } else if (content.type === "thinking") {
        elements.push(<ThinkingBlock key={block.id} block={block} />);
      }
      // tool_result blocks are skipped as they're shown with their tool_use
    }
  });

  flushToolGroup();

  return <div className="flex flex-col gap-2">{elements}</div>;
}
