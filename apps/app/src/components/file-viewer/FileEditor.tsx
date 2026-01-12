import { useEffect, useState, useCallback, useRef } from 'react'
import Editor from '@monaco-editor/react'

interface FileEditorProps {
  filePath: string | null
  className?: string
}

interface ExternalChangeNotification {
  show: boolean
  filePath: string
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
  fish: 'shell',
  ps1: 'powershell',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  conf: 'ini',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  graphql: 'graphql',
  gql: 'graphql',
}

function getLanguageFromPath(filePath: string): string {
  const fileName = filePath.split('/').pop()?.toLowerCase() || ''

  // Check for special filenames
  if (fileName === 'dockerfile') return 'dockerfile'
  if (fileName === 'makefile') return 'makefile'
  if (fileName.startsWith('.env')) return 'ini'

  const ext = fileName.split('.').pop()?.toLowerCase()
  return LANGUAGE_MAP[ext || ''] || 'plaintext'
}

export function FileEditor({ filePath, className }: FileEditorProps) {
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [language, setLanguage] = useState('plaintext')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [externalChange, setExternalChange] = useState<ExternalChangeNotification>({
    show: false,
    filePath: ''
  })
  const isSavingRef = useRef(false)

  const isDirty = content !== originalContent

  const loadFile = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await window.api.fileSystem.readFile(path)
      if (response.success && response.content !== undefined) {
        setContent(response.content)
        setOriginalContent(response.content)
        setLanguage(getLanguageFromPath(path))
      } else {
        setError(response.error || 'Failed to read file')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load file when filePath changes
  useEffect(() => {
    // Always reset external change notification when switching files
    setExternalChange({ show: false, filePath: '' })

    if (!filePath) {
      setContent('')
      setOriginalContent('')
      setLanguage('plaintext')
      setError(null)
      return
    }

    loadFile(filePath)
  }, [filePath, loadFile])

  // File watching for external changes
  useEffect(() => {
    if (!filePath) return

    // Start watching the file
    window.api.fileSystem.watchFile(filePath)

    // Subscribe to file change events
    const unsubscribe = window.api.fileSystem.onFileChanged((event) => {
      // Ignore changes to other files
      if (event.filePath !== filePath) return

      // Ignore if we're the ones saving
      if (isSavingRef.current) return

      // If file was renamed/deleted, show error
      if (event.eventType === 'rename') {
        setError('File was renamed or deleted')
        return
      }

      // Check if editor has unsaved changes
      const currentIsDirty = content !== originalContent
      if (currentIsDirty) {
        // Show notification instead of auto-reloading
        setExternalChange({ show: true, filePath })
      } else {
        // Auto-reload if no unsaved changes
        loadFile(filePath)
      }
    })

    return () => {
      window.api.fileSystem.unwatchFile(filePath)
      unsubscribe()
    }
  }, [filePath, content, originalContent, loadFile])

  const handleReloadFile = useCallback(() => {
    if (filePath) {
      loadFile(filePath)
      setExternalChange({ show: false, filePath: '' })
    }
  }, [filePath, loadFile])

  const handleDismissNotification = useCallback(() => {
    setExternalChange({ show: false, filePath: '' })
  }, [])

  const handleSave = useCallback(async () => {
    if (!filePath || !isDirty) return

    try {
      isSavingRef.current = true
      const response = await window.api.fileSystem.writeFile(filePath, content)
      if (response.success) {
        setOriginalContent(content)
        setExternalChange({ show: false, filePath: '' })
      } else {
        console.error('Failed to save file:', response.error)
      }
    } catch (err) {
      console.error('Failed to save file:', err)
    } finally {
      // Small delay to ignore any file change events triggered by our save
      setTimeout(() => {
        isSavingRef.current = false
      }, 200)
    }
  }, [filePath, content, isDirty])

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  if (!filePath) {
    return (
      <div
        className={`flex items-center justify-center h-full bg-[#1e1e1e] text-gray-500 text-sm ${className || ''}`}
      >
        Select a file to view
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center h-full bg-[#1e1e1e] text-gray-400 text-sm ${className || ''}`}
      >
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center h-full bg-[#1e1e1e] text-red-400 text-sm p-4 ${className || ''}`}
      >
        {error}
      </div>
    )
  }

  return (
    <div className={`h-full flex flex-col bg-[#1e1e1e] ${className || ''}`}>
      {/* File header with dirty indicator */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-700 text-sm">
        <span className="text-gray-300 truncate">{filePath.split('/').pop()}</span>
        {isDirty && <span className="text-yellow-500">*</span>}
      </div>

      {/* External change notification */}
      {externalChange.show && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-yellow-900/50 border-b border-yellow-700 text-sm">
          <span className="text-yellow-200">
            This file has been changed externally. Your changes may be overwritten.
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleReloadFile}
              className="px-2 py-1 text-xs bg-yellow-600 hover:bg-yellow-500 text-white rounded"
            >
              Reload
            </button>
            <button
              onClick={handleDismissNotification}
              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Monaco Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={language}
          value={content}
          onChange={(value) => setContent(value ?? '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            renderWhitespace: 'selection',
          }}
        />
      </div>
    </div>
  )
}
