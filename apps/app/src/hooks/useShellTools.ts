import { useQuery } from "@rocicorp/zero/react";
import { queries } from "@jupiter/sync/queries/data";
import { useEffect, useMemo, useState } from "react";
import { ToolUseBlockParam } from "@anthropic-ai/sdk/resources";

export const useShellTools = (
  runtimeId: string | null,
  sessionId: string
): void => {
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

    // TODO: Run the tools
  }, [sessionTools]);

  useEffect(() => {
    console.log("runningTools", runningTools);
  }, [runningTools]);
};
