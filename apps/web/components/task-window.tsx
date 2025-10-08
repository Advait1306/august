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
import { useUser } from "@clerk/clerk-react";
import { Agent, Project } from "@jupiter/sync/zero/zero-schema.gen";

export default function TaskWindow() {
  const { user } = useUser();

  // Selector items
  const agents = useQuery(
    getAgents({ userId: user?.id ?? "no_user_id_available" })
  )[0];

  const projects = useQuery(
    getProjects({ userId: user?.id ?? "no_user_id_available" })
  )[0];

  // Messages
  const {
    selectedTask,
    messages,
    sendMessage,
    composerStates,
    setComposerStates,
    permissions,
  } = useTaskRuntime();

  // Derived state and functions for ease of use
  const selectedTaskId = selectedTask.id ?? "new-conversation";
  const composerState = composerStates[selectedTaskId];
  const prompt = composerState?.prompt ?? "";
  const agent = composerState?.agent ?? null;
  const project = composerState?.project ?? null;
  const pendingPermissions = permissions[selectedTaskId];

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
    <div className="flex-1 relative">
      {/* Thread */}
      <Conversation
        className="absolute w-full h-full p-8 overflow-auto pb-40"
        key={selectedTaskId}
      >
        <ConversationContent>
          {(messages ?? []).length === 0 ? (
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
        </ConversationContent>
        <ConversationScrollButton className="mb-40" />
      </Conversation>

      {/* Composer */}
      <PromptInput
        onSubmit={() => {}}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[80%] max-w-3xl"
      >
        <PromptInputBody>
          {pendingPermissions ? (
            <div className="flex justify-between items-center h-full pr-1 pl-4 py-1">
              <div>
                Allow <span>{pendingPermissions.toolName}</span> tool?
              </div>
              <ButtonGroup>
                <Button
                  variant="outline"
                  onClick={() => {
                    pendingPermissions.alwaysAllow();
                  }}
                >
                  Always Allow
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    pendingPermissions.grant();
                  }}
                >
                  Allow
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    pendingPermissions.deny();
                  }}
                >
                  Deny
                </Button>
              </ButtonGroup>
            </div>
          ) : (
            <PromptInputTextarea
              onChange={(e) => setPrompt(e.target.value)}
              value={prompt}
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
            disabled={false}
            status={"ready"}
            onClick={() => sendMessage(prompt)}
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}
