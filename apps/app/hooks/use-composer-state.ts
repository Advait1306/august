import { useCallback } from "react";

interface ComposerState {
  prompt: string;
  cwd: string;
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

  return {
    prompt,
    cwd,
    setPrompt,
    selectFolder,
    clearCwd,
  };
}
