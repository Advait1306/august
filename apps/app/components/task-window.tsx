import {
  PromptInput,
  PromptInputTextarea,
  PromptInputBody,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { useTaskRuntime } from "@/src/contexts/task-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { ButtonGroup } from "./ui/button-group";
import { Button } from "./ui/button";
import { useQuery } from "@rocicorp/zero/react";
import { getAgents } from "@jupiter/sync/queries/data";
import { Agent } from "@jupiter/sync/zero/zero-schema.gen";
import { BlinkingCursor } from "./blinking-cursor";
import { useSyncContext } from "@/src/components/sync_engine";
import { motion, AnimatePresence } from "motion/react";
import { VList, VListHandle } from "virtua";
import { UserMessagePartView, AssistantTextPartView } from "./message";
import { ToolGroupView } from "./tool-group";
import { AssistantContent, ToolResultPart } from "ai";
import {
  XIcon,
  PlusIcon,
  FolderIcon,
  BotIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { PromptMenu, type PromptMenuOption } from "@/components/prompt-menu";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { useScrollGradients } from "@/hooks/use-scroll-gradients";
import { CodeBlock } from "./ai-elements/code-block";

// Message part types for virtualization
type MessagePart =
  | { type: "user-content"; id: string; content: any; messageIndex: number }
  | {
      type: "assistant-text";
      id: string;
      text: string;
      messageIndex: number;
      partIndex: number;
    }
  | {
      type: "tool-group";
      id: string;
      tools: Array<{
        toolCall: any;
        toolResult: ToolResultPart | undefined;
        partIndex: number;
      }>;
      messageIndex: number;
      startPartIndex: number;
    };

// Transform messages into flat list of parts for virtualization
function flattenMessagesToParts(messages: readonly any[]): MessagePart[] {
  const parts: MessagePart[] = [];

  messages.forEach((message, messageIndex) => {
    if (message.role === "user") {
      parts.push({
        type: "user-content",
        id: `user-${messageIndex}`,
        content: message.content,
        messageIndex,
      });
    } else if (message.role === "assistant") {
      if (typeof message.content === "string") {
        parts.push({
          type: "assistant-text",
          id: `assistant-${messageIndex}-0`,
          text: message.content,
          messageIndex,
          partIndex: 0,
        });
      } else {
        const contentParts = message.content as Exclude<
          AssistantContent,
          string
        >;

        // Track consecutive tool calls to group them
        let currentToolGroup: Array<{
          toolCall: any;
          toolResult: ToolResultPart | undefined;
          partIndex: number;
        }> = [];
        let toolGroupStartIndex = -1;

        contentParts.forEach((content: any, partIndex: number) => {
          switch (content.type) {
            case "text":
              // If we have accumulated tools, push them as a group first
              if (currentToolGroup.length > 0) {
                parts.push({
                  type: "tool-group",
                  id: `assistant-${messageIndex}-group-${toolGroupStartIndex}`,
                  tools: currentToolGroup,
                  messageIndex,
                  startPartIndex: toolGroupStartIndex,
                });
                currentToolGroup = [];
                toolGroupStartIndex = -1;
              }

              // Add the text part
              parts.push({
                type: "assistant-text",
                id: `assistant-${messageIndex}-${partIndex}`,
                text: content.text,
                messageIndex,
                partIndex,
              });
              break;
            case "tool-call": {
              const result = contentParts.find(
                (part): part is ToolResultPart =>
                  part.type === "tool-result" &&
                  part.toolCallId === content.toolCallId
              );

              // Start or continue tool group
              if (currentToolGroup.length === 0) {
                toolGroupStartIndex = partIndex;
              }
              currentToolGroup.push({
                toolCall: content,
                toolResult: result,
                partIndex,
              });
              break;
            }
            case "tool-result":
              // Skip tool-results as they're handled in tool-call
              break;
          }
        });

        // Handle any remaining tools at the end
        if (currentToolGroup.length > 0) {
          parts.push({
            type: "tool-group",
            id: `assistant-${messageIndex}-group-${toolGroupStartIndex}`,
            tools: currentToolGroup,
            messageIndex,
            startPartIndex: toolGroupStartIndex,
          });
        }
      }
    }
  });

  return parts;
}

export default function TaskWindow() {
  const syncData = useSyncContext();

  // Selector items
  const agents = useQuery(getAgents(syncData.authData))[0];

  const virtualizerRef = useRef<VListHandle>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Hover states for badges
  const [isAgentBadgeHovered, setIsAgentBadgeHovered] = useState(false);
  const [isCwdBadgeHovered, setIsCwdBadgeHovered] = useState(false);

  // Messages
  const {
    selectedTaskId,
    selectedTask,
    messages,
    sendMessage,
    stopGeneration,
    composerStates,
    setComposerStates,
    permissions,
    generationState,
    defaultCwd,
  } = useTaskRuntime();

  // Flatten messages into parts for virtualization
  const messageParts = useMemo(() => {
    return messages ? flattenMessagesToParts(messages) : [];
  }, [messages]);

  // Use scroll gradients hook with drillToScrollElement for VList
  const { showTopGradient, showBottomGradient, recalculate } =
    useScrollGradients(scrollContainerRef, {
      drillToScrollElement: true,
      initDelay: 100,
    });

  // Derived state and functions for ease of use
  const composerState = composerStates[selectedTaskId];
  const prompt = composerState?.prompt ?? "";
  const agent =
    selectedTaskId === "new-conversation"
      ? composerState?.agent
      : agents.find((agent) =>
          selectedTask && typeof selectedTask === "object"
            ? agent.id === selectedTask.agent_id
            : false
        );
  const cwd = composerState?.cwd ?? "";
  const pendingPermissions = permissions[selectedTaskId] || [];
  const currentPermission = pendingPermissions[0];
  // const currentPermission = false;
  const isGenerating = generationState.includes(selectedTaskId);

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

  // Only allowed for "new-conversation"
  const setAgent = useCallback(
    (agent: Agent) => {
      setComposerStates((prev) => {
        return {
          ...prev,
          [selectedTaskId]: {
            ...prev[selectedTaskId],
            agent,
          },
        };
      });
    },
    [setComposerStates, selectedTaskId]
  );

  // Only allowed for "new-conversation"
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

  // Clear agent selection
  const clearAgent = useCallback(() => {
    setComposerStates((prev) => {
      return {
        ...prev,
        [selectedTaskId]: {
          ...prev[selectedTaskId],
          agent: undefined,
        },
      };
    });
  }, [setComposerStates, selectedTaskId]);

  // Clear cwd selection (revert to default)
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

  // Note: This effect may cause a jarring scroll when switching tasks, as it attempts to scroll to the end
  // of the previous task's message list before the new task's messages are loaded. This works for now,
  // but could be improved by checking if messageParts.length > 0 or using a different dependency array.
  useEffect(() => {
    if (virtualizerRef.current) {
      virtualizerRef.current.scrollToIndex(messageParts.length - 1, {
        align: "end",
      });
    }
  }, [selectedTaskId, messages]);

  // Recalculate gradients when messages or task changes
  useEffect(() => {
    recalculate();
  }, [messages, selectedTaskId, recalculate]);

  // Menu options for @ hotkey
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

  return (
    <motion.div className="flex-1 relative" layout>
      {/* Header */}
      {selectedTaskId !== "new-conversation" && (
        <div className="px-4 py-2 w-full h-[50px] border-b border-border flex items-center justify-between">
          {agent ? <span className="text-md">{agent?.name}</span> : <div />}
          {cwd && cwd !== defaultCwd && (
            <Button variant="ghost" className="rounded" size="sm" disabled>
              <span className="text-xs flex items-center gap-1">
                <FolderIcon className="w-4 h-4" />
                {cwd.match(/[^/\\]+$/)?.[0] || "Folder"}
              </span>
            </Button>
          )}
        </div>
      )}

      {/* Thread */}
      <motion.div
        layout
        className="absolute w-full h-[calc(100%-210px)] px-8 bottom-40 flex justify-center"
      >
        {selectedTaskId === "new-conversation" ? (
          <ConversationEmptyState
            icon={
              <div className="h-[40px] w-[40px] rounded-[20px] bg-primary" />
            }
            className="-translate-y-1/5"
            title="Start a task"
            description="Share an idea with your artificial helper"
          />
        ) : (
          <motion.div
            ref={scrollContainerRef}
            layout
            className="relative h-full w-full max-w-[720px]"
          >
            <AnimatePresence>
              <VList
                className="h-full no-scrollbar w-full"
                ref={virtualizerRef}
              >
                {messageParts.map((part) => (
                  <motion.div key={part.id} layout layoutId={part.id}>
                    {part.type === "user-content" && (
                      <UserMessagePartView content={part.content} />
                    )}
                    {part.type === "assistant-text" && (
                      <AssistantTextPartView text={part.text} />
                    )}
                    {part.type === "tool-group" && (
                      <ToolGroupView tools={part.tools} />
                    )}
                  </motion.div>
                ))}
                {isGenerating && <BlinkingCursor />}
              </VList>
            </AnimatePresence>

            {/* Gradient Overlays */}
            {showTopGradient && (
              <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-background via-background/50 to-transparent" />
              </div>
            )}
            {showBottomGradient && (
              <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none z-10">
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
              </div>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Composer & Permission Container */}
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-[80%] max-w-3xl"
        initial={{
          y: 40,
          opacity: 0,
        }}
        animate={{
          y:
            selectedTaskId === "new-conversation"
              ? "0%"
              : "calc(50vh - 50% - 1.5rem)",
          opacity: 1,
        }}
        transition={{
          type: "spring",
          stiffness: 2000,
          damping: 200,
        }}
      >
        {/* Composer */}
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
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 py-2 rounded cursor-pointer"
                    onMouseEnter={() => setIsAgentBadgeHovered(true)}
                    onMouseLeave={() => setIsAgentBadgeHovered(false)}
                    onClick={clearAgent}
                  >
                    <AnimatePresence>
                      {isAgentBadgeHovered && (
                        <motion.div
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: "auto", opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 2000,
                            damping: 200,
                          }}
                          layout
                        >
                          <XIcon className="w-4 h-4" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <BotIcon className="w-4 h-4" />
                    <span>{agent?.name || "Agent"}</span>
                  </Badge>
                )}
                {selectedTaskId === "new-conversation" &&
                  cwd &&
                  cwd !== defaultCwd && (
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 py-2 rounded cursor-pointer"
                      onMouseEnter={() => setIsCwdBadgeHovered(true)}
                      onMouseLeave={() => setIsCwdBadgeHovered(false)}
                      onClick={clearCwd}
                    >
                      <AnimatePresence>
                        {isCwdBadgeHovered && (
                          <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "auto", opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{
                              type: "spring",
                              stiffness: 2000,
                              damping: 200,
                            }}
                            layout
                          >
                            <XIcon className="w-4 h-4" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <FolderIcon className="w-4 h-4" />
                      <span>{cwd.match(/[^/\\]+$/)?.[0] || "Folder"}</span>
                    </Badge>
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

        {/* Permission */}
        {currentPermission && (
          <motion.div
            className="absolute bottom-0 w-full flex justify-between items-center p-4 mb-4 bg-background rounded-2xl border border-border"
            initial={{
              y: 100,
              opacity: 0,
            }}
            animate={{
              y: 0,
              opacity: 1,
            }}
            transition={{
              type: "spring",
              stiffness: 2000,
              damping: 200,
            }}
          >
            <div className="w-full flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <div className="w-full flex justify-between items-center gap-2">
                  <span className="font-semibold">
                    {currentPermission.toolName}
                  </span>
                  {pendingPermissions.length === 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground ml-2">
                        (1 of {pendingPermissions.length})
                      </span>
                      <ButtonGroup>
                        <Button
                          variant="outline"
                          onClick={() => {}}
                          size={"xs"}
                        >
                          <ChevronLeftIcon className="w-2 h-2" />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {}}
                          size={"xs"}
                        >
                          <ChevronRightIcon className="w-2 h-2" />
                        </Button>
                      </ButtonGroup>
                    </div>
                  )}
                </div>

                <CodeBlock
                  code={JSON.stringify(currentPermission.input, null, 2)}
                  language="json"
                  className="w-full border-none [&_pre]:!p-0"
                />
              </div>
              <div className="absolute bottom-4 right-4 w-full flex justify-end">
                <ButtonGroup>
                  <Button
                    variant="outline"
                    onClick={() => {
                      currentPermission.alwaysAllow();
                    }}
                  >
                    Always Allow
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      currentPermission.grant();
                    }}
                  >
                    Allow
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      currentPermission.deny();
                    }}
                  >
                    Deny
                  </Button>
                </ButtonGroup>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
