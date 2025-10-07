import { Message, MessageContent } from "@/src/components/ai-elements/message";
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
} from "@/src/components/ai-elements/prompt-input";
import { Response } from "@/src/components/ai-elements/response";
import { useTaskRuntime } from "@/src/contexts/task-runtime";
import { useAgentStore } from "@/src/stores/agentStore";
import { useProjectStore } from "@/src/stores/projectStore";
import { Agent } from "@/src/types/agent";
import { Project } from "@/src/types/project";

import { useCallback, useEffect } from "react";

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
  const composerState = composerStates[selectedTask.id as string];
  const prompt = composerState?.prompt ?? "";
  const agent = composerState?.agent ?? null;
  const project = composerState?.project ?? null;

  const setPrompt = useCallback(
    (prompt: string) => {
      // @ts-ignore
      setComposerStates((prev) => {
        return {
          ...prev,
          [selectedTask.id as string]: {
            ...prev[selectedTask.id as string],
            prompt,
          },
        };
      });
    },
    [setComposerStates, selectedTask.id]
  );

  const setAgent = useCallback(
    (agent: Agent) => {
      // @ts-ignore
      setComposerStates((prev) => {
        return {
          ...prev,
          [selectedTask.id as string]: {
            ...prev[selectedTask.id as string],
            agent,
          },
        };
      });
    },
    [setComposerStates, selectedTask.id]
  );

  const setProject = useCallback(
    (project: Project) => {
      // @ts-ignore
      setComposerStates((prev) => {
        return {
          ...prev,
          [selectedTask.id as string]: {
            ...prev[selectedTask.id as string],
            project,
          },
        };
      });
    },
    [setComposerStates, selectedTask.id]
  );

  useEffect(() => {
    loadProjects();
    loadAgents();
  }, [loadProjects, loadAgents]);

  return (
    <div className="flex-1 relative">
      <div className="absolute flex-1 h-full p-8 overflow-auto pb-40">
        {selectedTask != "new-conversation" && (
          <div className="flex flex-col gap-4">
            {messages?.map((message: any, index: number) => {
              if (message.role === "user") {
                return (
                  <Message from="user" key={index}>
                    <MessageContent className="rounded-3xl">
                      {JSON.stringify(message)}
                    </MessageContent>
                  </Message>
                );
              } else {
                return (
                  <Response key={index}>{JSON.stringify(message)}</Response>
                );
              }
            })}
          </div>
        )}
      </div>
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
