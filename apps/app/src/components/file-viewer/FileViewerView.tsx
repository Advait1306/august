import { useState, useCallback, useEffect } from 'react'
import { FileExplorer } from './FileExplorer'
import { FileEditor } from './FileEditor'

interface FileViewerViewProps {
  rootPath?: string
  showHidden?: boolean
  initialFilePath?: string
  onFileSelect?: (filePath: string | null) => void
  className?: string
}

export function FileViewerView({ rootPath, showHidden, initialFilePath, onFileSelect, className }: FileViewerViewProps) {
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(initialFilePath ?? null)

  // Notify parent when file selection changes
  useEffect(() => {
    onFileSelect?.(selectedFilePath)
  }, [selectedFilePath, onFileSelect])

  const handleFileSelect = useCallback((filePath: string) => {
    setSelectedFilePath(filePath)
  }, [])

  return (
    <div className={`flex h-full bg-background ${className || ''}`}>
      {/* File Explorer - 25% width */}
      <div className="w-1/4 min-w-[200px] border-r border-border overflow-hidden">
        <FileExplorer
          rootPath={rootPath}
          showHidden={showHidden}
          onFileSelect={handleFileSelect}
          className="h-full"
        />
      </div>

      {/* Editor - 75% width */}
      <div className="w-3/4 flex-1 overflow-hidden">
        <FileEditor filePath={selectedFilePath} className="h-full" />
      </div>
    </div>
  )
}

export default FileViewerView
