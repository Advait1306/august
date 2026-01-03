import { useState, useEffect } from "react";
import { useZero } from "@/src/hooks/useZero";
import { mutators } from "@jupiter/sync/mutators/data";

const RUNTIME_ID_PREFIX = "august-runtime-id";

/**
 * Fetches shell tools manifest if running in Electron
 */
async function getShellToolsManifest(): Promise<
  { name: string; version: string }[]
> {
  // Check if we're running in Electron with shell tools available
  if (typeof window !== "undefined" && window.api?.shellTools) {
    try {
      const manifest = await window.api.shellTools.getManifest();
      return manifest.tools.map((tool) => ({
        name: tool.name,
        version: tool.version,
      }));
    } catch (error) {
      console.error("Failed to get shell tools manifest:", error);
      return [];
    }
  }
  return [];
}

export const useRuntimeId = (
  userId: string | null | undefined
): string | null => {
  const z = useZero();

  const [runtimeId, setRuntimeId] = useState<string | null>(() => {
    if (!userId) return null;

    const key = `${RUNTIME_ID_PREFIX}-${userId}`;
    let id = localStorage.getItem(key);

    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }

    return id;
  });

  useEffect(() => {
    if (!userId) {
      setRuntimeId(null);
      return;
    }

    const key = `${RUNTIME_ID_PREFIX}-${userId}`;
    let id = localStorage.getItem(key);

    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }

    setRuntimeId(id);

    // Register the runtime in the database with tools manifest
    const registerRuntime = async () => {
      const tools = await getShellToolsManifest();
      z.mutate(mutators.runtimes.register({ runtime_id: id, tools }));
    };

    registerRuntime();
  }, [userId, z]);

  return runtimeId;
};
