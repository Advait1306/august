import { ZeroProvider } from "@rocicorp/zero/react";
import { schema } from "../../../server/src/zero/zero-schema.gen";
import { SignedIn, SignedOut, useAuth, useUser } from "@clerk/clerk-react";

const ZERO_URL = import.meta.env.VITE_ZERO_URL;

export const SyncEngine = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();

  return (
    <>
      <SignedIn>
        <ZeroProvider schema={schema} userID={user?.id ?? ""} server={ZERO_URL}>
          {children}
        </ZeroProvider>
      </SignedIn>
      <SignedOut>{children}</SignedOut>
    </>
  );
};
