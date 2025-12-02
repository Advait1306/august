import { useMemo } from "react";
import { Agent } from "@jupiter/sync/zero/zero-schema.gen";
import { PromptMenuOption } from "@/components/prompt-menu";

interface UsePromptMenuProps {
  agents: Agent[];
  setAgent: (agent: Agent) => void;
  selectFolder: () => void;
}

export function usePromptMenu({
  agents,
  setAgent,
  selectFolder,
}: UsePromptMenuProps) {
  const menuOptions = useMemo<PromptMenuOption[]>(() => {
    return [
      {
        label: "Agent",
        value: "agent",
        children: agents.map((agent) => ({
          label: agent.name,
          value: `agent-${agent.id}`,
          onSelect: () => {
            const selectedAgent = agents.find((a) => a.id === agent.id);
            if (selectedAgent) {
              setAgent(selectedAgent);
            }
          },
        })),
      },
      {
        label: "Working Folder",
        value: "folder",
        onSelect: () => {
          selectFolder();
        },
      },
    ];
  }, [agents, setAgent, selectFolder]);

  return { menuOptions };
}
