import { useEffect } from "react";
import { useUpdate, useUpdateStatus } from "../src/contexts/update-context";
import { toast } from "sonner";

export function UpdateToast() {
  const { quitAndInstall } = useUpdate();
  const {
    isUpdateAvailable,
    isDownloading,
    isUpdateReady,
    hasError,
    updateInfo,
    progress,
    error,
  } = useUpdateStatus();

  useEffect(() => {
    if (isUpdateAvailable && !isDownloading && !isUpdateReady) {
      // Show update available toast
      const version = updateInfo?.releaseName || `Version ${updateInfo?.version}`;
      toast.info(`Update Available: ${version} is downloading...`, {
        id: "update-available",
        duration: Infinity,
        dismissible: false,
      });
    }
  }, [isUpdateAvailable, isDownloading, isUpdateReady, updateInfo]);

  useEffect(() => {
    if (isDownloading && progress) {
      // Update or show downloading toast
      const percent = Math.round(progress.percent);
      toast.loading(`Downloading Update: ${percent}%`, {
        id: "update-downloading",
        duration: Infinity,
        dismissible: false,
      });
    }
  }, [isDownloading, progress]);

  useEffect(() => {
    if (isUpdateReady) {
      // Show update ready toast
      toast.dismiss("update-available");
      toast.dismiss("update-downloading");

      const version = updateInfo?.version ? `Version ${updateInfo.version}` : "Update";
      toast.success(`${version} downloaded. Click to restart and install.`, {
        id: "update-ready",
        duration: Infinity,
        dismissible: false,
        action: {
          label: "Restart Now",
          onClick: quitAndInstall,
        },
      });
    }
  }, [isUpdateReady, quitAndInstall, updateInfo]);

  useEffect(() => {
    if (hasError && error) {
      // Show error toast
      toast.dismiss("update-available");
      toast.dismiss("update-downloading");

      toast.error(`Update Failed: ${error.message}`, {
        id: "update-error",
        duration: 10000, // Auto-dismiss after 10 seconds
      });
    }
  }, [hasError, error]);

  // This component doesn't render anything directly
  // All UI is handled through toasts
  return null;
}
