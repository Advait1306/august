import { useState } from 'react'
import { FileExplorer } from './FileExplorer'
import { FileEditor } from './FileEditor'

interface FileViewerViewProps {
  rootPath?: string
  showHidden?: boolean
  className?: string
}

export function FileViewerView({ rootPath, showHidden, className }: FileViewerViewProps) {
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)

  return (
    <div className={`flex h-full bg-[#1e1e1e] ${className || ''}`}>
      {/* File Explorer - 25% width */}
      <div className="w-1/4 min-w-[200px] border-r border-gray-700 overflow-hidden">
        <FileExplorer
          rootPath={rootPath}
          showHidden={showHidden}
          onFileSelect={setSelectedFilePath}
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
