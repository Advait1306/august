import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputBody,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Button } from "./ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { PromptMenu, type PromptMenuOption } from "@/components/prompt-menu";
import { ComposerBadge } from "./composer-badge";
import { PlusIcon, FolderIcon } from "lucide-react";
import { Permission } from "@jupiter/shared/types";

interface TaskComposerProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  isGenerating: boolean;
  sendMessage: (prompt: string) => void;
  stopGeneration: (taskId: string) => void;
  selectedTaskId: string;
  cwd: string;
  defaultCwd: string;
  menuOptions: PromptMenuOption[];
  clearCwd: () => void;
  currentPermission: Permission | undefined;
}

export function TaskComposer({
  prompt,
  setPrompt,
  isGenerating,
  sendMessage,
  stopGeneration,
  selectedTaskId,
  cwd,
  defaultCwd,
  menuOptions,
  clearCwd,
  currentPermission,
}: TaskComposerProps) {
  const [isCwdBadgeHovered, setIsCwdBadgeHovered] = useState(false);

  return (
    <motion.div
      animate={{
        scale: currentPermission ? 0.95 : 1,
        y: currentPermission ? -30 : 0,
      }}
    >
      <PromptInput
        onSubmit={(_, e) => {
          // If generating, stop the generation instead of submitting
          if (isGenerating) {
            e.preventDefault();
            stopGeneration(selectedTaskId);
            return;
          }
          sendMessage(prompt);
        }}
        className="p-2 mb-4 rounded-2xl shadow-[0px_6px_52px_-14px_rgba(0,0,0,0.1)] "
      >
        <PromptInputBody>
          <PromptInputTextarea
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
            value={prompt}
            hotkey={selectedTaskId === "new-conversation" ? "/" : undefined}
            hotkeyMenu={
              selectedTaskId === "new-conversation"
                ? ({ onQuery, removeHotkeyCharacter, onClose }) => (
                    <PromptMenu
                      onQuery={onQuery}
                      removeHotkeyCharacter={removeHotkeyCharacter}
                      onClose={onClose}
                      options={menuOptions}
                      className="mt-4"
                    />
                  )
                : undefined
            }
          />
        </PromptInputBody>
        <PromptInputToolbar>
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 2000,
                damping: 200,
              }}
            >
              <PromptInputTools>
                {selectedTaskId === "new-conversation" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-md"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PromptMenu options={menuOptions} />
                  </Popover>
                )}
                {selectedTaskId === "new-conversation" &&
                  cwd &&
                  cwd !== defaultCwd && (
                    <ComposerBadge
                      icon={<FolderIcon className="w-4 h-4" />}
                      label={cwd.match(/[^/\\]+$/)?.[0] || "Folder"}
                      onClear={clearCwd}
                      isHovered={isCwdBadgeHovered}
                      setIsHovered={setIsCwdBadgeHovered}
                    />
                  )}
              </PromptInputTools>
            </motion.div>
          </AnimatePresence>
          <PromptInputSubmit
            className="rounded-lg"
            disabled={!isGenerating && prompt.trim().length === 0}
            status={isGenerating ? "streaming" : "ready"}
          />
        </PromptInputToolbar>
      </PromptInput>
    </motion.div>
  );
}
