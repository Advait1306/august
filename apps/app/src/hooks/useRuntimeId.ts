import { useState, useEffect } from "react";
import { useZero } from "@/src/hooks/useZero";
import { mutators } from "@jupiter/sync/mutators/data";

const RUNTIME_ID_PREFIX = "august-runtime-id";

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

    // Register the runtime in the database (upsert is idempotent)
    z.mutate(mutators.runtimes.register({ runtime_id: id }));
  }, [userId, z]);

  return runtimeId;
};
