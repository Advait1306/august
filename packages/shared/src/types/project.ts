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
