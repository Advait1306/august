import { useQuery } from "@rocicorp/zero/react";
import { queries } from "@jupiter/sync/queries/data";
import {
  BetaContentBlockParam,
  BetaToolUseBlockParam,
} from "@anthropic-ai/sdk/resources/beta";
import {
  Turn as TurnType,
  Block as BlockType,
} from "@jupiter/sync/zero/zero-schema.gen";
import {
  UserTextBlock,
  AssistantTextBlock,
  ThinkingBlock,
  ToolUseBlock,
} from "./blocks";
import { useMemo } from "react";

interface TurnProps {
  turn: TurnType;
}

const FILTERED_TOOL_NAMES = ["TodoWrite"];

export function Turn({ turn }: TurnProps) {
  // Fetch blocks for this turn
  const [blocks] = useQuery(queries.blocks.byTurn({ turnId: turn.id }));

  // Skip turns with tool result blocks,
  // they will be shown along with tool_use block
  if (blocks.find((block) => block.type === "tool_result")) {
    return null;
  }

  switch (turn.type) {
    case "user":
      return <UserTurn blocks={blocks as BlockType[]} />;
    case "assistant":
      return <AssistantTurn blocks={blocks as BlockType[]} />;
    default:
      return <div>Unknown turn type found: {turn.type}</div>;
  }
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

type GroupedBlock =
  | { type: "text"; block: BlockType }
  | { type: "thinking"; block: BlockType }
  | { type: "tool_group"; blocks: BlockType[] };

function groupBlocks(blocks: BlockType[]): GroupedBlock[] {
  return blocks.reduce<GroupedBlock[]>((acc, block) => {
    const content = block.content as BetaContentBlockParam;

    if (content.type === "tool_use") {
      const toolContent = content as BetaToolUseBlockParam;
      if (FILTERED_TOOL_NAMES.includes(toolContent.name)) return acc;

      const last = acc[acc.length - 1];
      if (last?.type === "tool_group") {
        last.blocks.push(block);
        return acc;
      }
      return [...acc, { type: "tool_group", blocks: [block] }];
    }

    if (content.type === "text") return [...acc, { type: "text", block }];
    if (content.type === "thinking")
      return [...acc, { type: "thinking", block }];
    return acc;
  }, []);
}

function AssistantTurn({ blocks }: { blocks: BlockType[] }) {
  const grouped = useMemo(() => groupBlocks(blocks), [blocks]);

  return (
    <div className="flex flex-col gap-2">
      {grouped.map((item) => {
        switch (item.type) {
          case "text":
            return (
              <AssistantTextBlock key={item.block.id} block={item.block} />
            );
          case "thinking":
            return <ThinkingBlock key={item.block.id} block={item.block} />;
          case "tool_group":
            return (
              <div
                key={`tool-group-${item.blocks[0].id}`}
                className="w-full flex gap-2 flex-wrap pb-2"
              >
                {item.blocks.map((b) => (
                  <ToolUseBlock key={b.id} block={b} />
                ))}
              </div>
            );
        }
      })}
    </div>
  );
}
