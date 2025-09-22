import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

// Types for auto-updater events
export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseName?: string | null;
  releaseNotes?: string | null;
}

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdateError {
  message: string;
  error?: string;
  stack?: string;
}

export type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "error"
  | "not-available";

export interface UpdateContextType {
  state: UpdateState;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: UpdateError | null;
  checkForUpdates: () => void;
  quitAndInstall: () => void;
}

const UpdateContext = createContext<UpdateContextType | null>(null);

export interface UpdateProviderProps {
  children: ReactNode;
}

export function UpdateProvider({ children }: UpdateProviderProps) {
  const [state, setState] = useState<UpdateState>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<UpdateError | null>(null);

  useEffect(() => {
    // Only setup listeners if we're in electron
    if (!window.electron) {
      return;
    }

    // Setup event listeners for auto-updater events
    const removeListeners: (() => void)[] = [];

    // Update checking
    const removeCheckingListener = window.electron.ipcRenderer.on(
      "auto-updater:update-checking",
      () => {
        setState("checking");
        setError(null);
      }
    );
    removeListeners.push(removeCheckingListener);

    // Update available
    const removeAvailableListener = window.electron.ipcRenderer.on(
      "auto-updater:update-available",
      (_, info: UpdateInfo) => {
        setState("available");
        setUpdateInfo(info);
        setError(null);
      }
    );
    removeListeners.push(removeAvailableListener);

    // Update not available
    const removeNotAvailableListener = window.electron.ipcRenderer.on(
      "auto-updater:update-not-available",
      () => {
        setState("not-available");
        setError(null);
      }
    );
    removeListeners.push(removeNotAvailableListener);

    // Download progress
    const removeProgressListener = window.electron.ipcRenderer.on(
      "auto-updater:update-download-progress",
      (_, progressData: UpdateProgress) => {
        setState("downloading");
        setProgress(progressData);
        setError(null);
      }
    );
    removeListeners.push(removeProgressListener);

    // Update downloaded
    const removeDownloadedListener = window.electron.ipcRenderer.on(
      "auto-updater:update-downloaded",
      (_, info: UpdateInfo) => {
        setState("downloaded");
        setUpdateInfo(info);
        setProgress(null);
        setError(null);
      }
    );
    removeListeners.push(removeDownloadedListener);

    // Update error
    const removeErrorListener = window.electron.ipcRenderer.on(
      "auto-updater:update-error",
      (_, errorInfo: UpdateError) => {
        setState("error");
        setError(errorInfo);
      }
    );
    removeListeners.push(removeErrorListener);

    // Cleanup function
    return () => {
      removeListeners.forEach((remove) => remove());
    };
  }, []);

  const checkForUpdates = async () => {
    if (!window.api?.autoUpdater) {
      console.warn("Auto-updater API not available");
      return;
    }

    try {
      setState("checking");
      setError(null);
      await window.api.autoUpdater.checkForUpdates();
    } catch (err) {
      setState("error");
      setError({
        message: "Failed to check for updates",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const quitAndInstall = async () => {
    if (!window.api?.autoUpdater) {
      console.warn("Auto-updater API not available");
      return;
    }

    try {
      await window.api.autoUpdater.quitAndInstall();
    } catch (err) {
      setState("error");
      setError({
        message: "Failed to install update",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const value: UpdateContextType = {
    state,
    updateInfo,
    progress,
    error,
    checkForUpdates,
    quitAndInstall,
  };

  return (
    <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
  );
}

export function useUpdate(): UpdateContextType {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error("useUpdate must be used within an UpdateProvider");
  }
  return context;
}

// Hook to check if updates are available (utility)
export function useUpdateStatus() {
  const { state, updateInfo, progress, error } = useUpdate();

  return {
    isChecking: state === "checking",
    isUpdateAvailable: state === "available",
    isDownloading: state === "downloading",
    isUpdateReady: state === "downloaded",
    hasError: state === "error",
    updateInfo,
    progress,
    error,
  };
}
