import { useState, useEffect, useCallback, useMemo } from 'react'
import { File } from 'lucide-react'
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

interface FileResult {
  path: string
  name: string
  extension: string
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
    (filePath: string, fileName: string) => {
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
              key={file.path}
              value={`${file.name} ${file.path}`}
              onSelect={() => handleSelect(file.path, file.name)}
            >
              <File className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="ml-2 text-xs text-muted-foreground truncate max-w-[300px]">
                {file.path}
              </span>
            </CommandItem>
          ))
        )}
      </CommandList>
    </CommandDialog>
  )
}
