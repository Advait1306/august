import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputActionMenuItem,
} from "@/components/ai-elements/prompt-input";
import { useTaskRuntime } from "@/src/contexts/task-runtime";
import { useCallback } from "react";
import { AssistantMessage, UserMessage } from "./message";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { ButtonGroup } from "./ui/button-group";
import { Button } from "./ui/button";
import { useQuery } from "@rocicorp/zero/react";
import { getAgents, getProjects } from "@jupiter/sync/queries/data";
import { Agent, Project } from "@jupiter/sync/zero/zero-schema.gen";
import { BlinkingCursor } from "./blinking-cursor";
import { useSyncContext } from "@/src/components/sync_engine";
import { motion } from "motion/react";

export default function TaskWindow() {
  const syncData = useSyncContext();

  // Selector items
  const agents = useQuery(getAgents(syncData.authData))[0];

  const projects = useQuery(getProjects(syncData.authData))[0];

  // Messages
  const {
    selectedTaskId,
    selectedTask,
    messages,
    sendMessage,
    composerStates,
    setComposerStates,
    permissions,
    generationState,
  } = useTaskRuntime();

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
  const project =
    selectedTaskId === "new-conversation"
      ? composerState?.project
      : projects.find((project) =>
          selectedTask && typeof selectedTask === "object"
            ? project.id === selectedTask.project_id
            : false
        );
  const pendingPermissions = permissions[selectedTaskId] || [];
  const currentPermission = pendingPermissions[0];
  const isGenerating = generationState.includes(selectedTaskId);

  const setPrompt = useCallback(
    (prompt: string) => {
      // @ts-ignore
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
      // @ts-ignore
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
  const setProject = useCallback(
    (project: Project) => {
      // @ts-ignore
      setComposerStates((prev) => {
        return {
          ...prev,
          [selectedTaskId]: {
            ...prev[selectedTaskId],
            project,
          },
        };
      });
    },
    [setComposerStates, selectedTaskId]
  );

  return (
    <motion.div className="flex-1 relative" layout>
      {/* Thread */}
      <Conversation
        className="absolute w-full h-full p-8 overflow-auto pb-40 no-scrollbar"
        key={selectedTaskId}
      >
        <ConversationContent>
          {selectedTaskId === "new-conversation" ? (
            <ConversationEmptyState
              icon={
                <div className="h-[40px] w-[40px] rounded-[20px] bg-primary" />
              }
              title="Start a task"
              description="Share an idea with your artificial helper"
            />
          ) : (
            messages?.map((message: any, index: number) => {
              if (message.role === "user") {
                return <UserMessage key={index} message={message} />;
              } else {
                return <AssistantMessage key={index} message={message} />;
              }
            })
          )}
          {isGenerating && <BlinkingCursor />}
        </ConversationContent>

        <ConversationScrollButton className="mb-40" />
      </Conversation>

      {/* Composer */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 w-[80%] max-w-3xl bottom-8"
        animate={{
          y:
            selectedTaskId === "new-conversation"
              ? "calc(-50vh + 50% + 2rem)"
              : "0%",
        }}
        transition={{
          type: "spring",
          stiffness: 2000,
          damping: 200,
        }}
      >
        <PromptInput
          onSubmit={() => {
            sendMessage(prompt);
          }}
        >
          <PromptInputBody>
            {currentPermission ? (
              <div className="flex justify-between items-center h-full pr-1 pl-4 py-1">
                <div>
                  Allow <span>{currentPermission.toolName}</span> tool?
                  {pendingPermissions.length > 1 && (
                    <span className="text-muted-foreground ml-2">
                      (1 of {pendingPermissions.length})
                    </span>
                  )}
                </div>
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
            ) : (
              <PromptInputTextarea
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating}
                value={prompt}
                mentionOptions={[
                  { label: "Agent", value: "@agent" },
                  { label: "Project", value: "@project" },
                  { label: "Task", value: "@task" },
                  { label: "File", value: "@file" },
                  { label: "User", value: "@user" },
                ]}
              />
            )}
          </PromptInputBody>
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger
                  size={"lg"}
                  disabled={selectedTaskId !== "new-conversation"}
                >
                  <span>{agent?.name || "Agent"}</span>
                </PromptInputActionMenuTrigger>
                <PromptInputActionMenuContent>
                  {agents.map((agent) => (
                    <PromptInputActionMenuItem
                      key={agent.id}
                      onClick={() => setAgent(agent)}
                    >
                      {agent.name}
                    </PromptInputActionMenuItem>
                  ))}
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger
                  size={"lg"}
                  disabled={selectedTaskId !== "new-conversation"}
                >
                  <span>{project?.name || "Project"}</span>
                </PromptInputActionMenuTrigger>
                <PromptInputActionMenuContent>
                  {projects.map((project) => (
                    <PromptInputActionMenuItem
                      key={project.id}
                      onClick={() => setProject(project)}
                    >
                      {project.name}
                    </PromptInputActionMenuItem>
                  ))}
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={isGenerating}
              status={isGenerating ? "streaming" : "ready"}
            />
          </PromptInputToolbar>
        </PromptInput>
      </motion.div>
    </motion.div>
  );
}
