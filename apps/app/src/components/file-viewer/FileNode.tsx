import { NodeRendererProps } from 'react-arborist'
import { File, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react'
import type { FileNode as FileNodeData } from './useFileSystem'

export function FileNode({ node, style, dragHandle }: NodeRendererProps<FileNodeData>) {
  const isDirectory = node.data.isDirectory

  return (
    <div
      ref={dragHandle}
      style={style}
      className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer select-none text-sm
        ${node.isSelected ? 'bg-blue-600/30' : 'hover:bg-gray-700/50'}
        ${node.isFocused ? 'ring-1 ring-blue-500/50' : ''}`}
      onClick={() => node.isInternal && node.toggle()}
    >
      {/* Expand/collapse arrow for directories */}
      {isDirectory ? (
        <span className="w-4 h-4 flex items-center justify-center text-gray-400">
          {node.isOpen ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </span>
      ) : (
        <span className="w-4" />
      )}

      {/* Icon */}
      {isDirectory ? (
        node.isOpen ? (
          <FolderOpen className="w-4 h-4 text-yellow-500 flex-shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
        )
      ) : (
        <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
      )}

      {/* Name */}
      {node.isEditing ? (
        <input
          type="text"
          defaultValue={node.data.name}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => node.reset()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              node.submit(e.currentTarget.value)
            } else if (e.key === 'Escape') {
              node.reset()
            }
          }}
          autoFocus
          className="bg-gray-800 border border-blue-500 rounded px-1 text-sm text-gray-200 outline-none flex-1 min-w-0"
        />
      ) : (
        <span className="text-gray-200 truncate">{node.data.name}</span>
      )}
    </div>
  )
}
