import { createUseZero, ZeroProvider } from "@rocicorp/zero/react";
import { schema, Schema } from "@jupiter/sync/zero/schema";
import { createMutators, Mutators } from "@jupiter/sync/mutators/data";
import {
  ClerkLoaded,
  SignedIn,
  SignedOut,
  useAuth,
  useOrganization,
  useUser,
} from "@clerk/clerk-react";
import { createContext, useContext, useMemo } from "react";

const ZERO_URL = import.meta.env.VITE_ZERO_URL;

type SyncContext = {
  authData: {
    userId: string;
    orgId: string;
  };
};

const SyncContext = createContext<SyncContext>({
  authData: {
    userId: "",
    orgId: "",
  },
});

export const SyncEngine = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  const { organization, isLoaded: isOrgLoaded } = useOrganization();
  const { getToken } = useAuth();

  const authData = useMemo(() => {
    return {
      userId: user?.id ?? "no_user_available",
      orgId: isOrgLoaded
        ? organization && organization.id
          ? organization.id
          : (user?.id ?? "no_org_available")
        : "no_org_available",
    };
  }, [user, organization, isOrgLoaded]);

  return (
    <>
      <ClerkLoaded>
        <SignedIn>
          <ZeroProvider
            schema={schema}
            userID={`${authData.userId}-${authData.orgId}`}
            server={ZERO_URL}
            auth={async () => {
              const token = await getToken();
              // ZeroProvider expects undefined, not null
              return token === null ? undefined : token;
            }}
            mutators={createMutators({
              userId: user?.id ?? "",
              orgId: organization?.id ?? "",
            })}
          >
            <SyncContext.Provider value={{ authData }}>
              {children}
            </SyncContext.Provider>
          </ZeroProvider>
        </SignedIn>
        <SignedOut>{children}</SignedOut>
      </ClerkLoaded>
    </>
  );
};

export const useZero = createUseZero<Schema, Mutators>();

export const useSyncContext = () => {
  const context = useContext(SyncContext);

  if (!context) {
    throw new Error("useSyncContext must be used within a SyncContextProvider");
  }

  return context;
};
