import { ZeroProvider } from "@rocicorp/zero/react";
import { schema } from "../../../server/src/zero/zero-schema.gen";
import {
  ClerkLoaded,
  SignedIn,
  SignedOut,
  useAuth,
  useUser,
} from "@clerk/clerk-react";

const ZERO_URL = import.meta.env.VITE_ZERO_URL;

export const SyncEngine = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  const { getToken } = useAuth();

  return (
    <>
      <ClerkLoaded>
        <SignedIn>
          <ZeroProvider
            schema={schema}
            userID={user?.id ?? ""}
            server={ZERO_URL}
            auth={async () => {
              const token = await getToken();
              // ZeroProvider expects undefined, not null
              return token === null ? undefined : token;
            }}
          >
            {children}
          </ZeroProvider>
        </SignedIn>
        <SignedOut>{children}</SignedOut>
      </ClerkLoaded>
    </>
  );
};
