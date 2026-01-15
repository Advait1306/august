import { useState, useEffect, useCallback, useMemo } from 'react'
import { File, FileText } from 'lucide-react'
import debounce from 'lodash.debounce'
import { nanoid } from 'nanoid'

import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useWorkspaceStore } from '@/src/stores/workspace-store'
import type { IPC } from '@jupiter/shared/ipc'

const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.cache',
  '__pycache__',
]

type FileResult = IPC.FileSystem.SearchFileResult

/**
 * Renders text with highlighted portions based on character ranges
 */
function HighlightedText({
  text,
  highlights,
}: {
  text: string
  highlights?: Array<[number, number]>
}) {
  if (!highlights || highlights.length === 0) {
    return <span>{text}</span>
  }

  const parts: React.ReactNode[] = []
  let lastIndex = 0

  for (const [start, end] of highlights) {
    // Add non-highlighted text before this range
    if (start > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>{text.slice(lastIndex, start)}</span>
      )
    }
    // Add highlighted text
    parts.push(
      <span key={`highlight-${start}`} className="bg-yellow-300/50 dark:bg-yellow-600/50 rounded-sm">
        {text.slice(start, end)}
      </span>
    )
    lastIndex = end
  }

  // Add remaining text after the last highlight
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>)
  }

  return <>{parts}</>
}

interface FileOpenerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FileOpener({ open, onOpenChange }: FileOpenerProps) {
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<FileResult[]>([])

  const api = useWorkspaceStore((state) => state.getActiveWorkspaceApi())
  const activeWorkspace = useWorkspaceStore((state) => state.getActiveWorkspace())
  const workspaceCwd = activeWorkspace?.cwd ?? null

  const searchFiles = useCallback(
    async (searchQuery: string) => {
      if (!workspaceCwd) return

      try {
        const result = await window.api.fileSystem.searchFiles({
          path: workspaceCwd,
          query: searchQuery,
          excludePatterns: EXCLUDE_PATTERNS,
          maxResults: 50,
        })

        if (result.success && result.files) {
          setFiles(result.files)
        } else {
          setFiles([])
        }
      } catch (error) {
        console.error('Failed to search files:', error)
        setFiles([])
      }
    },
    [workspaceCwd]
  )

  const debouncedSearch = useMemo(
    () => debounce((q: string) => searchFiles(q), 200),
    [searchFiles]
  )

  // Search when query changes
  useEffect(() => {
    if (open) {
      debouncedSearch(query)
    }
    return () => {
      debouncedSearch.cancel()
    }
  }, [query, open, debouncedSearch])

  // Reset query when opening (debounced effect handles the search)
  useEffect(() => {
    if (open) {
      setQuery('')
    }
  }, [open])

  const handleSelect = useCallback(
    (filePath: string, fileName: string, lineNumber?: number) => {
      if (!api || !workspaceCwd) return

      // Construct full file path (simple join for browser compatibility)
      const cwd = workspaceCwd.endsWith('/') ? workspaceCwd.slice(0, -1) : workspaceCwd
      const fullPath = `${cwd}/${filePath}`

      // Open file in a new FileViewer panel
      api.addPanel({
        id: `file-viewer-${nanoid(8)}`,
        component: 'file-viewer',
        title: fileName,
        params: {
          rootPath: workspaceCwd,
          initialFilePath: fullPath,
          ...(lineNumber && { initialLine: lineNumber }),
        },
      })

      onOpenChange(false)
    },
    [api, workspaceCwd, onOpenChange]
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Open File"
      description="Search for files in your workspace"
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Search files..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="h-[300px]">
        {files.length === 0 ? (
          <CommandEmpty>No files found.</CommandEmpty>
        ) : (
          files.map((file) => (
            <CommandItem
              key={`${file.path}-${file.matchType}-${file.contentLine ?? ''}`}
              value={`${file.name} ${file.path}`}
              onSelect={() => handleSelect(file.path, file.name, file.contentLine)}
              className="flex flex-col items-start gap-0.5 py-2"
            >
              <div className="flex items-center w-full">
                {file.matchType === 'content' ? (
                  <FileText className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <File className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className="flex-1 truncate">
                  {file.matchType === 'name' && file.highlights ? (
                    <HighlightedText text={file.name} highlights={file.highlights} />
                  ) : (
                    file.name
                  )}
                </span>
                <span className="ml-2 text-xs text-muted-foreground truncate max-w-[300px]">
                  {file.matchType === 'path' && file.highlights ? (
                    <HighlightedText text={file.path} highlights={file.highlights} />
                  ) : (
                    file.path
                  )}
                </span>
              </div>
              {file.matchType === 'content' && file.contentPreview && (
                <div className="ml-6 text-xs text-muted-foreground truncate w-full">
                  <span className="text-muted-foreground/70">
                    Line {file.contentLine}:
                  </span>{' '}
                  {file.contentPreview}
                </div>
              )}
            </CommandItem>
          ))
        )}
      </CommandList>
    </CommandDialog>
  )
}
