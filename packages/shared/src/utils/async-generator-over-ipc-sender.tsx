import { IpcMainInvokeEvent } from "electron";

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
