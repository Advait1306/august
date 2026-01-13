import { useCallback } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { FileViewerView } from '../../file-viewer'
import type { FileViewerPanelParams } from '../types'

/**
 * File Viewer panel component for Dockview
 * Wraps the FileViewerView component with explorer + editor
 */
export function FileViewerPanel({
  params,
  api,
}: IDockviewPanelProps<FileViewerPanelParams>) {
  const handleFileSelect = useCallback(
    (filePath: string | null) => {
      if (filePath) {
        // Extract filename from path
        const fileName = filePath.split('/').pop() || 'File Viewer'
        api.setTitle(fileName)
      } else {
        api.setTitle('File Viewer')
      }
    },
    [api]
  )

  return (
    <FileViewerView
      rootPath={params.rootPath}
      showHidden={params.showHidden}
      initialFilePath={params.initialFilePath}
      onFileSelect={handleFileSelect}
      className="h-full w-full"
    />
  )
}
