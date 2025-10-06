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
import { useAgentStore } from "@/src/stores/agentStore";
import { useProjectStore } from "@/src/stores/projectStore";
import { Agent } from "@/src/types/agent";
import { Project } from "@/src/types/project";
import { useEffect, useState } from "react";

export default function TaskWindow() {
  const { projects, loadProjects } = useProjectStore();
  const { agents, loadAgents } = useAgentStore();

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const [prompt, setPrompt] = useState<string>("");

  const text =
    "**Hi there.** I am an AI model designed to help you. ``` This is a code snippet ``` \n The quadratic formula is $$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$ for solving $$ax^2 + bx + c = 0$$. Euler's identity: $$e^{i\pi} + 1 = 0$$ combines five fundamental";

  useEffect(() => {
    loadProjects();
    loadAgents();
  }, [loadProjects, loadAgents]);

  return (
    <div className="flex-1 relative">
      <div className="flex-1 h-full p-8">
        <Message from="user">
          <MessageContent className="rounded-3xl">Hi there!</MessageContent>
        </Message>
        <Response>{text}</Response>
      </div>
      <PromptInput
        onSubmit={() => {}}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl"
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
