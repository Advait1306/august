import { useEffect, useCallback, useState } from 'react'
import { GitDiffList } from './GitDiffList'
import { IPC } from '@jupiter/shared/ipc'

interface GitDiffPanelProps {
  workspaceCwd: string
}

export function GitDiffPanel({ workspaceCwd }: GitDiffPanelProps) {
  const [gitStatus, setGitStatus] = useState<IPC.Git.StatusResponse | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)

  const fetchStatus = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsLoadingStatus(true)
    }
    try {
      const response = await window.api?.git?.status(workspaceCwd)
      if (response?.success) {
        setGitStatus(response)
      }
    } catch {
      // Silently fail on errors
    } finally {
      if (showLoading) {
        setIsLoadingStatus(false)
      }
    }
  }, [workspaceCwd])

  // Initial fetch and set up file watcher
  useEffect(() => {
    // Fetch initial status
    fetchStatus(true)

    // Start watching for git changes
    window.api?.git?.watch(workspaceCwd)

    // Subscribe to change events
    const unsubscribe = window.api?.git?.onChanged((event) => {
      if (event.cwd === workspaceCwd) {
        fetchStatus(false)
      }
    })

    return () => {
      // Stop watching and unsubscribe
      window.api?.git?.unwatch(workspaceCwd)
      unsubscribe?.()
    }
  }, [workspaceCwd, fetchStatus])

  // Combine all changed files
  const allFiles = [
    ...(gitStatus?.staged || []),
    ...(gitStatus?.unstaged || []),
    ...(gitStatus?.untracked || []),
  ]

  return (
    <div className="h-full flex flex-col bg-background border-l border-border">
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-border shrink-0">
        <span className="font-medium text-sm">Git Changes</span>
        <span className="ml-2 text-xs text-muted-foreground">({allFiles.length})</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoadingStatus ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Loading changes...
          </div>
        ) : (
          <GitDiffList files={allFiles} workspaceCwd={workspaceCwd} />
        )}
      </div>
    </div>
  )
}
