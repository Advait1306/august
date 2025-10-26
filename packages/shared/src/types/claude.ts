export interface ClaudeInstallation {
  path: string;
  version?: string;
  source: string;
  installationType: 'system' | 'custom';
}
