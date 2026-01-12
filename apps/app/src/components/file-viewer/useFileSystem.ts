import { useState, useCallback, useEffect } from 'react'

// Cross-platform path helper functions

/**
 * Gets the parent path from a full path, handling both Unix (/) and Windows (\) separators.
 * Returns the root path if the file is at the root level.
 */
function getParentPath(filePath: string): string {
  // Find the last occurrence of either separator
  const lastForwardSlash = filePath.lastIndexOf('/')
  const lastBackSlash = filePath.lastIndexOf('\\')
  const lastSeparator = Math.max(lastForwardSlash, lastBackSlash)

  if (lastSeparator <= 0) {
    // Root level file: return root appropriately
    // For Unix paths like "/file.txt", return "/"
    // For Windows paths like "C:\file.txt", return "C:\"
    if (filePath.startsWith('/')) {
      return '/'
    }
    // Windows drive root (e.g., "C:\file.txt" where lastSeparator is 2)
    const driveMatch = filePath.match(/^[a-zA-Z]:/)
    if (driveMatch) {
      return driveMatch[0] + '\\'
    }
    // Fallback: return the path itself if no separator found
    return filePath
  }

  return filePath.substring(0, lastSeparator)
}

/**
 * Joins a parent path with a child name using the appropriate separator.
 * Detects the separator style from the parent path.
 */
function joinPath(parentPath: string, name: string): string {
  // Detect separator from the parent path
  const hasBackslash = parentPath.includes('\\')
  const separator = hasBackslash ? '\\' : '/'

  // Handle root paths that already end with a separator
  if (parentPath.endsWith('/') || parentPath.endsWith('\\')) {
    return parentPath + name
  }

  return parentPath + separator + name
}

/**
 * Validates that a filename does not contain path separators.
 * Returns true if the name is valid, false otherwise.
 */
function isValidFileName(name: string): boolean {
  return !name.includes('/') && !name.includes('\\')
}

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
      if (!isValidFileName(name)) {
        console.error('Invalid filename: name cannot contain path separators')
        return false
      }
      const filePath = joinPath(parentPath, name)
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
      if (!isValidFileName(name)) {
        console.error('Invalid folder name: name cannot contain path separators')
        return false
      }
      const folderPath = joinPath(parentPath, name)
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
      if (!isValidFileName(newName)) {
        console.error('Invalid name: name cannot contain path separators')
        return false
      }
      const parentPath = getParentPath(oldPath)
      const newPath = joinPath(parentPath, newName)
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
