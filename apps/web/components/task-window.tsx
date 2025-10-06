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

import { useEffect, useState } from "react";

export default function TaskWindow() {
  const { projects, loadProjects } = useProjectStore();
  const { agents, loadAgents } = useAgentStore();

  const { selectedTask, messages } = useTaskRuntime();

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const [prompt, setPrompt] = useState<string>("");

  useEffect(() => {
    loadProjects();
    loadAgents();
  }, [loadProjects, loadAgents]);

  return (
    <div className="flex-1 relative">
      <div className="flex-1 h-full p-8">
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
            onChange={(e) => {
              setPrompt(e.target.value);
            }}
            value={prompt}
          />
        </PromptInputBody>
        <PromptInputToolbar>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger size={"lg"}>
                <span>{selectedAgent?.name || "Agent"}</span>
              </PromptInputActionMenuTrigger>
              <PromptInputActionMenuContent>
                {agents.map((agent) => (
                  <PromptInputActionMenuItem
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                  >
                    {agent.name}
                  </PromptInputActionMenuItem>
                ))}
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger size={"lg"}>
                <span>{selectedProject?.name || "Project"}</span>
              </PromptInputActionMenuTrigger>
              <PromptInputActionMenuContent>
                {projects.map((project) => (
                  <PromptInputActionMenuItem
                    key={project.id}
                    onClick={() => setSelectedProject(project)}
                  >
                    {project.name}
                  </PromptInputActionMenuItem>
                ))}
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
          </PromptInputTools>
          <PromptInputSubmit disabled={false} status={"ready"} />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}
