import { PermissionRequest } from "@jupiter/shared/types";
import { AssistantModelMessage, ModelMessage } from "ai";

export type agentTypes = {
  run: (
    options: {
      messages: ModelMessage[];
      runConfig: Record<string, unknown>;
      threadId: string;
    },
    systemPrompt: string,
    path?: string,
    env?: Record<string, string>
  ) => AsyncGenerator<AssistantModelMessage, void>;

  addPermissionHandler: (
    cb: (request: PermissionRequest) => void
  ) => () => void;
  grantPermission: (requestId: string) => void;
  denyPermission: (requestId: string) => void;
};
