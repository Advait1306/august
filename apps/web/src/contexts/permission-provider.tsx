import { createContext, useContext, useEffect, useState } from "react";
import { Permission } from "@jupiter/shared/types";

type PermissionState = Record<string, Permission>;

const PermissionProviderContext = createContext<PermissionState>({});

export function PermissionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [permissions, setPermissions] = useState<PermissionState>({});

  useEffect(() => {
    const removeListener = window.api.agent.addPermissionHandler((request) => {
      setPermissions((prev) => ({
        ...prev,
        [request.threadId]: {
          ...request,
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
