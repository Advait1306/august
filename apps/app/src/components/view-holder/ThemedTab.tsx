import { useState, useEffect } from 'react'
import { type IDockviewPanelHeaderProps } from 'dockview-react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Custom themed tab component for Dockview
 * Uses Tailwind classes directly for proper light/dark mode support
 */
export function ThemedTab({ api }: IDockviewPanelHeaderProps) {
  const [isActive, setIsActive] = useState(api.isActive)
  const [isGroupActive, setIsGroupActive] = useState(api.isGroupActive)

  useEffect(() => {
    const disposables = [
      api.onDidActiveChange(() => setIsActive(api.isActive)),
      api.onDidActiveGroupChange(() => setIsGroupActive(api.isGroupActive)),
    ]

    return () => disposables.forEach((d) => d.dispose())
  }, [api])

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    api.close()
  }

  const handleClick = () => {
    api.setActive()
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-3 h-full text-sm cursor-pointer transition-colors',
        'border-r border-neutral-300 dark:border-neutral-700',
        isActive && isGroupActive
          ? 'bg-white dark:bg-neutral-800 text-foreground font-medium'
          : 'bg-neutral-100 dark:bg-neutral-900 text-muted-foreground hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-foreground'
      )}
      onClick={handleClick}
    >
      <span className="truncate max-w-[120px]">{api.title}</span>
      <button
        onPointerDown={(e) => e.preventDefault()}
        onClick={handleClose}
        className="ml-1 p-0.5 rounded hover:bg-accent transition-colors opacity-60 hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
