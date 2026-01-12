import { type IDockviewPanelHeaderProps } from 'dockview-react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Custom themed tab component for Dockview
 * Uses Tailwind classes directly for proper light/dark mode support
 */
export function ThemedTab({ api }: IDockviewPanelHeaderProps) {
  const isActive = api.isActive
  const isGroupActive = api.isGroupActive

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
          ? 'bg-background text-foreground'
          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
      onClick={handleClick}
    >
      <span className="truncate max-w-[120px]">{api.title}</span>
      <button
        onClick={handleClose}
        className="ml-1 p-0.5 rounded hover:bg-accent transition-colors opacity-60 hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
