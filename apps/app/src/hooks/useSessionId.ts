import { useMemo } from "react";

// Module-level variable that persists for the lifetime of the page
// but resets on every reload/refresh
let sessionId: string | null = null;

const getSessionId = (): string => {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
};

export const useSessionId = (): string => {
  // useMemo ensures we get the same ID throughout the component lifecycle
  // while the module-level variable ensures consistency across all components
  return useMemo(() => getSessionId(), []);
};
