import type { IDockviewPanelProps } from 'dockview-react'
import { GitDiffPanel } from '@/src/components/git-diff-viewer'

export interface GitDiffPanelParams {
  workspaceCwd: string
}

/**
 * Git diff panel wrapper for Dockview
 * Wraps the GitDiffPanel component for use in dockview
 */
export function GitDiffPanelWrapper({
  params,
}: IDockviewPanelProps<GitDiffPanelParams>) {
  return <GitDiffPanel workspaceCwd={params.workspaceCwd} />
}
