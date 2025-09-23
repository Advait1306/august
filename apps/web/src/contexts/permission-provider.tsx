import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Permission } from "@jupiter/shared/types";

type PermissionState = Record<string, Permission>;

const PermissionProviderContext = createContext<PermissionState>({});

export function PermissionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [permissions, setPermissions] = useState<PermissionState>({});
  const alwaysAllowThreads = useRef<string[]>([]);

  useEffect(() => {
    const removeListener = window.api.agent.addPermissionHandler((request) => {
      if (alwaysAllowThreads.current.includes(request.threadId)) {
        window.api.agent.grantPermission(request.id);
        return;
      }

      setPermissions((prev) => ({
        ...prev,
        [request.threadId]: {
          ...request,
          alwaysAllow: () => {
            alwaysAllowThreads.current.push(request.threadId);
            window.api.agent.grantPermission(request.id);
            setPermissions((prev) => {
              const newPermissions = { ...prev };
              delete newPermissions[request.threadId];
              return newPermissions;
            });
          },
          grant: () => {
            window.api.agent.grantPermission(request.id);
            setPermissions((prev) => {
              const newPermissions = { ...prev };
              delete newPermissions[request.threadId];
              return newPermissions;
            });
          },
          deny: () => {
            window.api.agent.denyPermission(request.id);
            setPermissions((prev) => {
              const newPermissions = { ...prev };
              delete newPermissions[request.threadId];
              return newPermissions;
            });
          },
        },
      }));
    });

    return () => {
      removeListener();
    };
  }, []);

  return (
    <PermissionProviderContext.Provider value={permissions}>
      {children}
    </PermissionProviderContext.Provider>
  );
}

export const usePermission = (threadId: string): Permission | undefined => {
  const context = useContext(PermissionProviderContext);

  if (context === undefined)
    throw new Error("usePermission must be used within a PermissionProvider");

  return context[threadId];
};
