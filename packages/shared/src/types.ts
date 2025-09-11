export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
}

export interface ProjectUpdate {
  name?: string;
  path?: string;
}

export type PermissionRequest = {
  id: string;
  threadId: string;
  toolName: string;
  input: Record<string, any>;
};

export type Permission = PermissionRequest & {
  grant: () => void;
  deny: () => void;
};
