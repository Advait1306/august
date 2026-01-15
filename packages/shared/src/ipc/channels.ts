export const IPC_CHANNELS = {
  AGENT: {
    RUN: 'agent:run',
    PERMISSION_REQUEST: 'permission:request',
    PERMISSION_RESPONSE: 'permission:response',
  },
  PROJECTS: {
    SELECT_FOLDER: 'projects:selectFolder',
    GET_DEFAULT_CWD: 'projects:getDefaultCwd',
  },
  AUTH: {
    OPEN_LOGIN: 'auth:open-login',
    TICKET_RECEIVED: 'auth:ticket-received',
  },
  AUTO_UPDATER: {
    CHECK: 'auto-updater:check-for-updates',
    QUIT_AND_INSTALL: 'auto-updater:quit-and-install',
    GET_INFO: 'auto-updater:get-update-info',
  },
  CLAUDE_CODE: {
    DISCOVER_INSTALLATIONS: 'claude-code:discoverInstallations',
  },
  BROWSER: {
    OPEN_URL: 'browser:open-url',
  },
  SHELL_TOOLS: {
    GET_MANIFEST: 'shell-tools:get-manifest',
    EXECUTE: 'shell-tools:execute',
  },
  TERMINAL: {
    CREATE: 'terminal:create',
    WRITE: 'terminal:write',
    RESIZE: 'terminal:resize',
    DESTROY: 'terminal:destroy',
    DATA: 'terminal:data',
    EXIT: 'terminal:exit',
  },
  FILE_SYSTEM: {
    READ_DIR: 'fs:readDir',
    CREATE_FILE: 'fs:createFile',
    CREATE_FOLDER: 'fs:createFolder',
    RENAME: 'fs:rename',
    DELETE: 'fs:delete',
    GET_HOME_DIR: 'fs:getHomeDir',
    READ_FILE: 'fs:readFile',
    WRITE_FILE: 'fs:writeFile',
    WATCH_FILE: 'fs:watchFile',
    UNWATCH_FILE: 'fs:unwatchFile',
    FILE_CHANGED: 'fs:fileChanged',
    SEARCH_FILES: 'fs:searchFiles',
    VALIDATE_DIRECTORY: 'fs:validateDirectory',
  },
} as const;
