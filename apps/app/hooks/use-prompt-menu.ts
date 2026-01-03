import { useMemo } from "react";
import { PromptMenuOption } from "@/components/prompt-menu";

interface UsePromptMenuProps {
  selectFolder: () => void;
}

export function usePromptMenu({ selectFolder }: UsePromptMenuProps) {
  const menuOptions = useMemo<PromptMenuOption[]>(() => {
    return [
      {
        label: "Working Folder",
        value: "folder",
        onSelect: () => {
          selectFolder();
        },
      },
    ];
  }, [selectFolder]);

  return { menuOptions };
}
