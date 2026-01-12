export interface Workspace {
  id: string
  name: string
  cwd: string
  createdAt: number
}

export interface WorkspaceState {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
}
