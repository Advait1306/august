import { ZeroProvider } from "@rocicorp/zero/react";
import { schema } from "@jupiter/sync/zero/schema";
import { createMutators } from "@jupiter/sync/mutators/data";
import {
  ClerkLoaded,
  SignedIn,
  SignedOut,
  useAuth,
  useOrganization,
  useUser,
} from "@clerk/clerk-react";
import { createContext, useContext, useMemo } from "react";
import { Zero } from "@rocicorp/zero";

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

  const authData = useMemo(
    () => {
      return {
        userId: user?.id ?? "no_user_available",
        orgId: isOrgLoaded
          ? organization && organization.id
            ? organization.id
            : (user?.id ?? "no_org_available")
          : "no_org_available",
      };
    },
    // Clerk updates other props, of user and org upon refocus,
    // we only need to update once the id changes
    [user?.id, organization?.id, isOrgLoaded]
  );

  const zero = useMemo(() => {
    return new Zero({
      userID: `${authData.userId}-${authData.orgId}`,
      schema,
      server: ZERO_URL,
      auth: async () => {
        const token = await getToken();
        return token === null ? undefined : token;
      },
      mutators: createMutators({
        userId: authData.userId,
        orgId: authData.orgId,
      }),
    });
  }, [authData, getToken]);

  return (
    <>
      <ClerkLoaded>
        <SignedIn>
          <ZeroProvider zero={zero}>
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

export const useSyncContext = () => {
  const context = useContext(SyncContext);

  if (!context) {
    throw new Error("useSyncContext must be used within a SyncContextProvider");
  }

  return context;
};
