import { IpcMainInvokeEvent, ipcMain } from "electron";

export function asyncGeneratorOverIPCSender<T>(
  event: IpcMainInvokeEvent,
  id: string,
  message: T
) {
  if (!event.sender.isDestroyed()) {
    event.sender.send(`stream:chunk-${id}`, message);
  }
}

export function asyncGeneratorOverIPCCloser(
  event: IpcMainInvokeEvent,
  id: string
) {
  if (!event.sender.isDestroyed()) {
    event.sender.send(`stream:done-${id}`);
  }
}

export function asyncGeneratorOverIPCCancelListener(
  event: IpcMainInvokeEvent,
  id: string,
  onCancel: () => void
): () => void {
  const cancelHandler = () => {
    onCancel();
  };

  // Listen for cancel signal from renderer
  ipcMain.on(`stream:cancel-${id}`, cancelHandler);

  // Return cleanup function
  return () => {
    ipcMain.removeListener(`stream:cancel-${id}`, cancelHandler);
  };
}
