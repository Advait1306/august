import { AssistantModelMessage } from "ai";
import { PermissionRequest } from "./common";
import { IPC } from "../ipc/contracts";

export type AgentRunResult = AsyncIterable<AssistantModelMessage> & {
  cancel: () => void;
};

export type AgentTypes = {
  run: (request: IPC.Agent.RunRequest) => AgentRunResult;
  addPermissionHandler: (
    cb: (request: PermissionRequest) => void
  ) => () => void;
  grantPermission: (requestId: string) => void;
  denyPermission: (requestId: string) => void;
};
