import { useCallback } from "react";
import type { SelectedSkill } from "@/components/ai-elements/prompt-input";

export type { SelectedSkill };

interface ComposerState {
  prompt: string;
  cwd: string;
  selectedSkills: SelectedSkill[];
}

interface UseComposerStateProps {
  selectedTaskId: string;
  composerStates: Record<string, ComposerState>;
  setComposerStates: React.Dispatch<
    React.SetStateAction<Record<string, ComposerState>>
  >;
  defaultCwd: string;
}

export function useComposerState({
  selectedTaskId,
  composerStates,
  setComposerStates,
  defaultCwd,
}: UseComposerStateProps) {
  const composerState = composerStates[selectedTaskId];
  const prompt = composerState?.prompt ?? "";
  const cwd = composerState?.cwd ?? "";
  const selectedSkills = composerState?.selectedSkills ?? [];

  const setPrompt = useCallback(
    (prompt: string) => {
      setComposerStates((prev) => {
        return {
          ...prev,
          [selectedTaskId]: {
            ...prev[selectedTaskId],
            prompt,
          },
        };
      });
    },
    [setComposerStates, selectedTaskId]
  );

  const selectFolder = useCallback(async () => {
    const folder = await window.api.projects.selectFolder();
    if (folder) {
      setComposerStates((prev) => {
        return {
          ...prev,
          [selectedTaskId]: {
            ...prev[selectedTaskId],
            cwd: folder.path,
          },
        };
      });
    }
  }, [setComposerStates, selectedTaskId]);

  const clearCwd = useCallback(() => {
    setComposerStates((prev) => {
      return {
        ...prev,
        [selectedTaskId]: {
          ...prev[selectedTaskId],
          cwd: defaultCwd,
        },
      };
    });
  }, [setComposerStates, selectedTaskId, defaultCwd]);

  const setSelectedSkills = useCallback(
    (skills: SelectedSkill[]) => {
      setComposerStates((prev) => {
        return {
          ...prev,
          [selectedTaskId]: {
            ...prev[selectedTaskId],
            selectedSkills: skills,
          },
        };
      });
    },
    [setComposerStates, selectedTaskId]
  );

  return {
    prompt,
    cwd,
    selectedSkills,
    setPrompt,
    selectFolder,
    clearCwd,
    setSelectedSkills,
  };
}
