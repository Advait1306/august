import { useState, useEffect, useCallback, useRef } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { FilePlus, FileMinus, FileEdit, ChevronDown, ChevronRight } from 'lucide-react'
import { useTheme } from '@/src/components/theme'
import { IPC } from '@jupiter/shared/ipc'
import type { DiffEditor as DiffEditorType } from 'monaco-editor'

interface GitFileDiffProps {
  filePath: string
  status: IPC.Git.FileStatus
  staged: boolean
  workspaceCwd: string
}

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  md: 'markdown',
  mdx: 'markdown',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  ini: 'ini',
}

function getLanguageFromPath(filePath: string): string {
  const fileName = filePath.split(/[/\\]/).pop()?.toLowerCase() || ''
  const ext = fileName.split('.').pop()?.toLowerCase()
  return LANGUAGE_MAP[ext || ''] || 'plaintext'
}

function getStatusIcon(status: IPC.Git.FileStatus) {
  switch (status) {
    case 'added':
    case 'untracked':
      return <FilePlus className="h-4 w-4 text-green-500" />
    case 'deleted':
      return <FileMinus className="h-4 w-4 text-red-500" />
    case 'modified':
    case 'renamed':
    default:
      return <FileEdit className="h-4 w-4 text-yellow-500" />
  }
}

function getStatusLabel(status: IPC.Git.FileStatus): string {
  switch (status) {
    case 'added':
      return 'Added'
    case 'deleted':
      return 'Deleted'
    case 'modified':
      return 'Modified'
    case 'renamed':
      return 'Renamed'
    case 'untracked':
      return 'Untracked'
    default:
      return status
  }
}

export function GitFileDiff({ filePath, status, staged, workspaceCwd }: GitFileDiffProps) {
  const theme = useTheme()
  const [isExpanded, setIsExpanded] = useState(true)
  const [original, setOriginal] = useState('')
  const [modified, setModified] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorHeight, setEditorHeight] = useState(100)
  const isMountedRef = useRef(true)
  const editorRef = useRef<DiffEditorType | null>(null)

  const fetchDiff = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true)
      setError(null)
    }

    try {
      const response = await window.api?.git?.diffFile({
        cwd: workspaceCwd,
        filePath,
        staged,
      })

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return

      if (response?.success) {
        setOriginal(response.original)
        setModified(response.modified)
        if (!showLoading) {
          setError(null)
        }
      } else if (showLoading) {
        setError(response?.error || 'Failed to fetch diff')
      }
    } catch (err) {
      if (!isMountedRef.current) return
      if (showLoading) {
        setError(err instanceof Error ? err.message : 'Failed to fetch diff')
      }
    } finally {
      if (isMountedRef.current && showLoading) {
        setIsLoading(false)
      }
    }
  }, [filePath, staged, workspaceCwd])

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      // Dispose editor to prevent "TextModel got disposed" errors
      if (editorRef.current) {
        editorRef.current.dispose()
        editorRef.current = null
      }
    }
  }, [])

  // Fetch diff and listen for changes
  useEffect(() => {
    // Initial fetch
    fetchDiff(true)

    // Subscribe to git change events to refresh diff
    const unsubscribe = window.api?.git?.onChanged((event) => {
      if (event.cwd === workspaceCwd && isExpanded) {
        fetchDiff(false)
      }
    })

    return () => {
      unsubscribe?.()
    }
  }, [workspaceCwd, fetchDiff, isExpanded])

  const language = getLanguageFromPath(filePath)

  const handleEditorMount = (editor: DiffEditorType) => {
    editorRef.current = editor
    const modifiedEditor = editor.getModifiedEditor()

    const updateHeight = () => {
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return
      // Use Monaco's content height directly
      const contentHeight = modifiedEditor.getContentHeight()
      setEditorHeight(contentHeight)
    }

    updateHeight()
    modifiedEditor.onDidContentSizeChange(updateHeight)
  }

  return (
    <div className="border-b border-border">
      {/* File Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        {getStatusIcon(status)}
        <span className="flex-1 truncate text-sm font-mono">{filePath}</span>
        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">
          {getStatusLabel(status)}
        </span>
      </button>

      {/* Diff Content */}
      {isExpanded && (
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
              Loading diff...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-24 text-destructive text-sm px-4">
              {error}
            </div>
          ) : (
            <DiffEditor
              height={editorHeight}
              language={language}
              original={original}
              modified={modified}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              onMount={handleEditorMount}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                renderSideBySide: false,
                useInlineViewWhenSpaceIsLimited: false,
                renderOverviewRuler: false,
                diffWordWrap: 'on',
                hideUnchangedRegions: {
                  enabled: true,
                },
                scrollbar: {
                  vertical: 'hidden',
                  horizontal: 'hidden',
                  handleMouseWheel: false,
                },
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
