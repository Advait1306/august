import { useCallback, useRef } from 'react'
import { Tree, TreeApi } from 'react-arborist'
import { useFileSystem, type FileNode as FileNodeData } from './useFileSystem'
import { FileNode } from './FileNode'

interface FileExplorerProps {
  rootPath?: string
  showHidden?: boolean
  onFileSelect: (path: string) => void
  className?: string
}

export function FileExplorer({
  rootPath,
  showHidden,
  onFileSelect,
  className,
}: FileExplorerProps) {
  const treeRef = useRef<TreeApi<FileNodeData>>(null)
  const { treeData, isLoading, error, loadChildren, rename, deleteItem, createFile, createFolder } =
    useFileSystem({ rootPath, showHidden })

  const handleSelect = useCallback(
    (nodes: FileNodeData[]) => {
      const node = nodes[0]
      if (node && !node.isDirectory) {
        onFileSelect(node.path)
      }
    },
    [onFileSelect]
  )

  const handleRename = useCallback(
    async ({ id, name }: { id: string; name: string }) => {
      await rename(id, name)
    },
    [rename]
  )

  const handleDelete = useCallback(
    async ({ ids }: { ids: string[] }) => {
      for (const id of ids) {
        await deleteItem(id)
      }
    },
    [deleteItem]
  )

  const handleCreate = useCallback(
    async ({
      parentId,
      type,
    }: {
      parentId: string | null
      index: number
      type: 'internal' | 'leaf'
    }) => {
      const parentPath = parentId || rootPath || '/'
      const name = type === 'internal' ? 'New Folder' : 'New File'

      if (type === 'internal') {
        await createFolder(parentPath, name)
      } else {
        await createFile(parentPath, name)
      }

      return null // Tree will refresh via the hook
    },
    [rootPath, createFile, createFolder]
  )

  // Load children when a directory is opened
  const handleToggle = useCallback(
    async (id: string) => {
      const node = treeRef.current?.get(id)
      if (node && node.data.isDirectory && node.data.children?.length === 0) {
        // Use loadChildren which updates state immutably
        await loadChildren(node.data.path)
      }
    },
    [loadChildren]
  )

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full text-red-400 text-sm p-4 ${className || ''}`}>
        {error}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full text-gray-400 text-sm ${className || ''}`}>
        Loading...
      </div>
    )
  }

  return (
    <div className={`h-full overflow-auto bg-background ${className || ''}`}>
      <Tree
        ref={treeRef}
        data={treeData}
        openByDefault={false}
        width="100%"
        height={1000}
        indent={16}
        rowHeight={24}
        onSelect={(nodes) => handleSelect(nodes.map((n) => n.data))}
        onRename={handleRename}
        onDelete={handleDelete}
        onCreate={handleCreate}
        onToggle={handleToggle}
      >
        {FileNode}
      </Tree>
    </div>
  )
}
