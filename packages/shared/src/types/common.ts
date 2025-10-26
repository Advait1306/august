export type PermissionRequest = {
  id: string;
  threadId: string;
  toolName: string;
  input: Record<string, any>;
};

export type Permission = PermissionRequest & {
  alwaysAllow: () => void;
  grant: () => void;
  deny: () => void;
};
