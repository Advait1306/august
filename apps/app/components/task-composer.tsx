import { motion } from "motion/react";
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
import { PlusIcon, FolderIcon, BotIcon } from "lucide-react";
import { Agent } from "@jupiter/sync/zero/zero-schema.gen";

interface TaskComposerProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  isGenerating: boolean;
  sendMessage: (prompt: string) => void;
  stopGeneration: (taskId: string) => void;
  selectedTaskId: string;
  agent?: Agent;
  cwd: string;
  defaultCwd: string;
  menuOptions: PromptMenuOption[];
  clearAgent: () => void;
  clearCwd: () => void;
  currentPermission: any;
}

export function TaskComposer({
  prompt,
  setPrompt,
  isGenerating,
  sendMessage,
  stopGeneration,
  selectedTaskId,
  agent,
  cwd,
  defaultCwd,
  menuOptions,
  clearAgent,
  clearCwd,
  currentPermission,
}: TaskComposerProps) {
  const [isAgentBadgeHovered, setIsAgentBadgeHovered] = useState(false);
  const [isCwdBadgeHovered, setIsCwdBadgeHovered] = useState(false);

  return (
    <motion.div
      animate={{
        scale: currentPermission ? 0.9 : 1,
        y: currentPermission ? -50 : 0,
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
        className="rounded-2xl p-2 mb-4"
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
            {selectedTaskId === "new-conversation" && agent && (
              <ComposerBadge
                icon={<BotIcon className="w-4 h-4" />}
                label={agent?.name || "Agent"}
                onClear={clearAgent}
                isHovered={isAgentBadgeHovered}
                setIsHovered={setIsAgentBadgeHovered}
              />
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
