export type AsyncTask = Array<() => Promise<void>>;

export type OAuthService = {
  revokeToken: (params: { mcpId: string }) => Promise<void>;
};

export type AgentLoopJobData = {
  task_id: string;
  turn_id: string;
  block_id: string;
};

export type AddToAgentLoopQueue = (data: AgentLoopJobData) => Promise<void>;

export type TrackEventFn = (
  event: string,
  properties: Record<string, any>
) => Promise<void>;
