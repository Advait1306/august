import { useCallback, type FC } from 'react'
import {
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useAssistantRuntime,
  useThreadListItem
} from '@assistant-ui/react'
import { ArchiveIcon, PlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button'
import { useCommandMenu } from '@/components/command-menu'

interface ThreadListProps {
  onNewTask?: () => void
}

export const ThreadList: FC<ThreadListProps> = ({ onNewTask }) => {
  return (
    <ThreadListPrimitive.Root className="text-foreground flex flex-col items-stretch gap-1.5">
      <ThreadListNew onNewTask={onNewTask} />
      <ThreadListItems />
    </ThreadListPrimitive.Root>
  )
}

interface ThreadListNewProps {
  onNewTask?: () => void
}

const ThreadListNew: FC<ThreadListNewProps> = ({ onNewTask }) => {
  const runtime = useAssistantRuntime()
  const callback = useCallback(() => {
    runtime.threads.switchToNewThread()
    // Focus the composer after switching to new thread
    if (onNewTask) {
      onNewTask()
    }
  }, [runtime, onNewTask])
  return (
    <Button
      className="data-active:bg-muted hover:bg-muted flex items-center justify-start gap-1 rounded-lg px-2.5 py-2 text-start"
      variant="ghost"
      disabled={!callback}
      onClick={callback}
      hotkey="c"
    >
      <PlusIcon />
      New Task
    </Button>
  )
}

const ThreadListItems: FC = () => {
  return <ThreadListPrimitive.Items components={{ ThreadListItem }} />
}

const ThreadListItem: FC = () => {
  const threadItem = useThreadListItem()
  const { addItemToContext, removeContextItem } = useCommandMenu()

  return (
    <ThreadListItemPrimitive.Root
      className="data-active:bg-muted hover:bg-muted focus-visible:bg-muted focus-visible:ring-ring flex items-center gap-2 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2"
      onMouseEnter={() => {
        if (threadItem) {
          const threadName = threadItem.title || 'New Chat'
          addItemToContext('task', threadItem.id, threadName, {
            remoteId: threadItem.remoteId
          })
        }
      }}
      onMouseLeave={() => removeContextItem()}
    >
      <ThreadListItemPrimitive.Trigger className="flex-grow px-3 py-2 text-start">
        <ThreadListItemTitle />
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemArchive />
    </ThreadListItemPrimitive.Root>
  )
}

const ThreadListItemTitle: FC = () => {
  return (
    <p className="text-sm">
      <ThreadListItemPrimitive.Title fallback="New Chat" />
    </p>
  )
}

const ThreadListItemArchive: FC = () => {
  return (
    <ThreadListItemPrimitive.Archive asChild>
      <TooltipIconButton
        className="hover:text-foreground/60 text-foreground ml-auto mr-1 size-4 p-4"
        variant="ghost"
        tooltip="Archive thread"
      >
        <ArchiveIcon />
      </TooltipIconButton>
    </ThreadListItemPrimitive.Archive>
  )
}
