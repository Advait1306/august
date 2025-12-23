import { useQuery } from "@rocicorp/zero/react";
import { queries } from "@jupiter/sync/queries/data";
import { useEffect, useMemo, useState } from "react";
import { ToolUseBlockParam } from "@anthropic-ai/sdk/resources";
import { IPC } from "@jupiter/shared/ipc";
import { useZero } from "@/src/hooks/useZero";
import { mutators } from "@jupiter/sync/mutators/data";

export const useShellTools = (
  runtimeId: string | null,
  sessionId: string
): void => {
  const z = useZero();
  const [runningTools, setRunningTools] = useState<ToolUseBlockParam["id"][]>(
    []
  );

  const [blocks] = useQuery(queries.blocks.getPendingShellTools());

  const runtimeTools = useMemo(() => {
    return blocks?.filter(
      (block) => block.turn?.task?.runtime_id === runtimeId
    );
  }, [blocks, runtimeId]);

  const sessionTools = useMemo(() => {
    return runtimeTools?.filter(
      (tool) => tool.turn?.task?.last_session_id === sessionId
    );
  }, [runtimeTools, sessionId]);

  useEffect(() => {
    if (!sessionTools) {
      return;
    }

    const newTools = sessionTools.filter(
      (block) => !runningTools.includes((block.content as ToolUseBlockParam).id)
    );

    setRunningTools((prev) => [
      ...prev,
      ...newTools.map((block) => (block.content as ToolUseBlockParam).id),
    ]);

    newTools.forEach((tool) => {
      const toolBlock = tool.content as ToolUseBlockParam;
      const name = toolBlock.name as
        | "grep"
        | "glob"
        | "ls"
        | "edit"
        | "write"
        | "multiedit";

      window.api.shellTools
        .execute(
          name,
          toolBlock.input as IPC.ShellTools.ToolInputMap[typeof name]
        )
        .then((result) => {
          const blockId = crypto.randomUUID();
          z.mutate(
            mutators.tools.submitResult({
              turn_id: tool.response_turn_id!,
              block_id: blockId,
              tool_block_id: tool.id,
              result: JSON.stringify(result),
              is_error: false,
            })
          ).client;
        })
        .catch((error) => {
          const blockId = crypto.randomUUID();
          z.mutate(
            mutators.tools.submitResult({
              turn_id: tool.response_turn_id!,
              block_id: blockId,
              tool_block_id: tool.id,
              result: JSON.stringify(error),
              is_error: true,
            })
          ).client;
        })
        .finally(() => {});
    });
  }, [sessionTools]);

  useEffect(() => {
    console.log("runningTools", runningTools);
  }, [runningTools]);
};
