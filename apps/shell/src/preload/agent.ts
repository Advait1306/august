import { asyncGeneratorOverIPCConsumer } from '@jupiter/shared/async-generator-over-ipc-consumer'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '@jupiter/shared/ipc'
import { AgentTypes } from '@jupiter/shared/types'

export const agent: AgentTypes = {
  // Agent execution
  run: (request) => {
    return asyncGeneratorOverIPCConsumer((id) => {
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.AGENT.RUN, {
        ...request,
        id
      })
    })
  },

  // Permission handling
  addPermissionHandler: (cb) => {
    const removeListener = electronAPI.ipcRenderer.on(
      IPC_CHANNELS.AGENT.PERMISSION_REQUEST,
      (_, request) => {
        cb(request)
      }
    )

    return () => {
      removeListener()
    }
  },

  grantPermission: (requestId) => {
    electronAPI.ipcRenderer.invoke(`${IPC_CHANNELS.AGENT.PERMISSION_RESPONSE}-${requestId}`, true)
  },

  denyPermission: (requestId) => {
    electronAPI.ipcRenderer.invoke(`${IPC_CHANNELS.AGENT.PERMISSION_RESPONSE}-${requestId}`, false)
  }
}
