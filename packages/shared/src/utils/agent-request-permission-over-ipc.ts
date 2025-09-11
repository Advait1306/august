import { ipcMain } from "electron";

export async function agentRequestPermissionOverIPC(
  event: Electron.IpcMainInvokeEvent,
  request: {
    toolName: string;
    input: Record<string, any>;
    threadId: string;
  }
): Promise<boolean> {
  const p = new Promise<boolean>((resolve) => {
    const requestId = crypto.randomUUID();
    try {
      event.sender.send(`permission:request`, {
        ...request,
        id: requestId,
      });
    } catch (error) {
      console.error("agentRequestPermissionOverIPC", error);
      resolve(false);
    }

    ipcMain.handle(`permission:response-${requestId}`, (_, response) => {
      resolve(response);
    });
  });

  return p;
}
