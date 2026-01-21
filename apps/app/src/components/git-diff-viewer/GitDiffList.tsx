import { GitFileDiff } from './GitFileDiff'
import { IPC } from '@jupiter/shared/ipc'

interface GitDiffListProps {
  files: IPC.Git.FileChange[]
  workspaceCwd: string
}

export function GitDiffList({ files, workspaceCwd }: GitDiffListProps) {
  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No changes to display
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {files.map((file) => (
        <GitFileDiff
          key={`${file.path}-${file.staged}`}
          filePath={file.path}
          status={file.status}
          staged={file.staged}
          workspaceCwd={workspaceCwd}
        />
      ))}
    </div>
  )
}
