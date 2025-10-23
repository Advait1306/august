import { AssistantModelMessage } from "ai";
import { PermissionRequest } from "./common";
import { IPC } from "../ipc/contracts";

export type AgentTypes = {
  run: (request: IPC.Agent.RunRequest) => AsyncIterable<AssistantModelMessage>;
  addPermissionHandler: (
    cb: (request: PermissionRequest) => void
  ) => () => void;
  grantPermission: (requestId: string) => void;
  denyPermission: (requestId: string) => void;
};
