import { ipcMain } from 'electron'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'
import { ptyService } from '../services/pty-service'

export function registerTerminalIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL.CREATE,
    (_event, request: IPC.Terminal.CreateRequest): IPC.Terminal.CreateResponse => {
      return ptyService.create(request)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL.WRITE,
    (_event, request: IPC.Terminal.WriteRequest): IPC.Terminal.OperationResponse => {
      return ptyService.write(request)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL.RESIZE,
    (_event, request: IPC.Terminal.ResizeRequest): IPC.Terminal.OperationResponse => {
      return ptyService.resize(request)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL.DESTROY,
    (_event, request: IPC.Terminal.DestroyRequest): IPC.Terminal.OperationResponse => {
      return ptyService.destroy(request)
    }
  )
}
