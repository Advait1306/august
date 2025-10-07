import {
  PromptInput,
  PromptInputAttachments,
  PromptInputAttachment,
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
import { useAgentStore } from "@/src/stores/agentStore";
import { useProjectStore } from "@/src/stores/projectStore";
import { Agent } from "@/src/types/agent";
import { Project } from "@/src/types/project";

import { useCallback, useEffect } from "react";
import { AssistantMessage, UserMessage } from "./message";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message } from "@/components/ai-elements/message";
import { MessageSquare } from "lucide-react";

export default function TaskWindow() {
  // Selector items
  const { projects, loadProjects } = useProjectStore();
  const { agents, loadAgents } = useAgentStore();

  // Messages
  const {
    selectedTask,
    messages,
    sendMessage,
    composerStates,
    setComposerStates,
  } = useTaskRuntime();

  // Derived state and functions for ease of use
  const selectedTaskId = selectedTask.id ?? "new-conversation";
  const composerState = composerStates[selectedTaskId];
  const prompt = composerState?.prompt ?? "";
  const agent = composerState?.agent ?? null;
  const project = composerState?.project ?? null;

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

  useEffect(() => {
    loadProjects();
    loadAgents();
  }, [loadProjects, loadAgents]);

  return (
    <div className="flex-1 relative">
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
      <PromptInput
        onSubmit={() => {}}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[80%] max-w-3xl"
      >
        <PromptInputBody>
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>
          <PromptInputTextarea
            onChange={(e) => setPrompt(e.target.value)}
            value={prompt}
          />
        </PromptInputBody>
        <PromptInputToolbar>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger size={"lg"}>
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
              <PromptInputActionMenuTrigger size={"lg"}>
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
