import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FolderOpen } from 'lucide-react'
import { useWorkspaceStore } from '@/src/stores/workspace-store'

interface AddWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddWorkspaceDialog({ open, onOpenChange }: AddWorkspaceDialogProps) {
  const [name, setName] = useState('')
  const [cwd, setCwd] = useState('')
  const [homeDir, setHomeDir] = useState('')
  const { createWorkspace } = useWorkspaceStore()

  // Fetch home directory on mount
  useEffect(() => {
    if (window.api?.fileSystem?.getHomeDir) {
      window.api.fileSystem.getHomeDir().then(setHomeDir)
    }
  }, [])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('')
      setCwd('')
    }
  }, [open])

  const handleSelectDirectory = async () => {
    if (window.api?.projects?.selectFolder) {
      const result = await window.api.projects.selectFolder()
      if (result?.path) {
        setCwd(result.path)
        // Auto-fill name from directory if empty
        if (!name && result.name) {
          setName(result.name)
        }
      }
    }
  }

  const handleCreate = () => {
    if (!name.trim()) return

    // Use selected cwd or default to home directory
    const workspaceCwd = cwd || homeDir
    createWorkspace(name.trim(), workspaceCwd)
    setName('')
    setCwd('')
    onOpenChange(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      handleCreate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Create a workspace to organize your terminals and files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="My Project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cwd">Working Directory</Label>
            <div className="flex gap-2">
              <Input
                id="cwd"
                placeholder={homeDir || '/path/to/directory'}
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleSelectDirectory}
                title="Browse..."
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Terminals and file viewers will start from this directory.
              {!cwd && homeDir && ` Defaults to ${homeDir}`}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create Workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
