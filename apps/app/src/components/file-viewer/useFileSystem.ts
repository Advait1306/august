import { useState, useCallback, useEffect } from 'react'

export interface FileNode {
  id: string
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

interface UseFileSystemOptions {
  rootPath?: string
  showHidden?: boolean
}

interface UseFileSystemReturn {
  treeData: FileNode[]
  isLoading: boolean
  error: string | null
  loadDirectory: (dirPath: string) => Promise<FileNode[]>
  loadChildren: (nodeId: string) => Promise<void>
  createFile: (parentPath: string, name: string) => Promise<boolean>
  createFolder: (parentPath: string, name: string) => Promise<boolean>
  rename: (oldPath: string, newName: string) => Promise<boolean>
  deleteItem: (path: string) => Promise<boolean>
  refresh: () => Promise<void>
}

export function useFileSystem(options: UseFileSystemOptions = {}): UseFileSystemReturn {
  const { rootPath, showHidden = false } = options
  const [treeData, setTreeData] = useState<FileNode[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actualRootPath, setActualRootPath] = useState<string | null>(null)

  const loadDirectory = useCallback(
    async (dirPath: string): Promise<FileNode[]> => {
      const response = await window.api.fileSystem.readDir(dirPath)
      if (!response.success || !response.entries) {
        throw new Error(response.error || 'Failed to read directory')
      }

      const entries = response.entries
        .filter((entry) => showHidden || !entry.name.startsWith('.'))
        .sort((a, b) => {
          // Directories first, then alphabetically
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        })

      return entries.map((entry) => ({
        id: entry.path,
        name: entry.name,
        path: entry.path,
        isDirectory: entry.isDirectory,
        children: entry.isDirectory ? [] : undefined,
      }))
    },
    [showHidden]
  )

  const loadInitialData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      let targetPath = rootPath
      if (!targetPath) {
        targetPath = await window.api.fileSystem.getHomeDir()
      }
      setActualRootPath(targetPath)

      const nodes = await loadDirectory(targetPath)
      setTreeData(nodes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory')
    } finally {
      setIsLoading(false)
    }
  }, [rootPath, loadDirectory])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const refresh = useCallback(async () => {
    if (actualRootPath) {
      const nodes = await loadDirectory(actualRootPath)
      setTreeData(nodes)
    }
  }, [actualRootPath, loadDirectory])

  // Helper to update children of a node immutably
  const updateNodeChildren = useCallback(
    (nodes: FileNode[], nodeId: string, children: FileNode[]): FileNode[] => {
      return nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, children }
        }
        if (node.children && node.children.length > 0) {
          return { ...node, children: updateNodeChildren(node.children, nodeId, children) }
        }
        return node
      })
    },
    []
  )

  // Load children for a specific node and update state
  const loadChildren = useCallback(
    async (nodeId: string) => {
      try {
        const children = await loadDirectory(nodeId)
        setTreeData((prev) => updateNodeChildren(prev, nodeId, children))
      } catch (err) {
        console.error('Failed to load directory children:', err)
      }
    },
    [loadDirectory, updateNodeChildren]
  )

  const createFile = useCallback(
    async (parentPath: string, name: string): Promise<boolean> => {
      const filePath = `${parentPath}/${name}`
      const response = await window.api.fileSystem.createFile(filePath)
      if (response.success) {
        await refresh()
      }
      return response.success
    },
    [refresh]
  )

  const createFolder = useCallback(
    async (parentPath: string, name: string): Promise<boolean> => {
      const folderPath = `${parentPath}/${name}`
      const response = await window.api.fileSystem.createFolder(folderPath)
      if (response.success) {
        await refresh()
      }
      return response.success
    },
    [refresh]
  )

  const rename = useCallback(
    async (oldPath: string, newName: string): Promise<boolean> => {
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'))
      const newPath = `${parentPath}/${newName}`
      const response = await window.api.fileSystem.rename(oldPath, newPath)
      if (response.success) {
        await refresh()
      }
      return response.success
    },
    [refresh]
  )

  const deleteItem = useCallback(
    async (path: string): Promise<boolean> => {
      const response = await window.api.fileSystem.delete(path)
      if (response.success) {
        await refresh()
      }
      return response.success
    },
    [refresh]
  )

  return {
    treeData,
    isLoading,
    error,
    loadDirectory,
    loadChildren,
    createFile,
    createFolder,
    rename,
    deleteItem,
    refresh,
  }
}
