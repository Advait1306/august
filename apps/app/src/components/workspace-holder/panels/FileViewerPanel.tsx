import type { IDockviewPanelProps } from 'dockview-react'
import { FileViewerView } from '../../file-viewer'
import type { FileViewerPanelParams } from '../types'

/**
 * File Viewer panel component for Dockview
 * Wraps the FileViewerView component with explorer + editor
 */
export function FileViewerPanel({
  params,
}: IDockviewPanelProps<FileViewerPanelParams>) {
  return (
    <FileViewerView
      rootPath={params.rootPath}
      showHidden={params.showHidden}
      initialFilePath={params.initialFilePath}
      className="h-full w-full"
    />
  )
}
