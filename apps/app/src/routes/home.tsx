import { WebOnly } from "@/components/restrictor";
import { Button } from "@/components/ui/button";
import {
  RedirectToSignIn,
  SignedIn,
  SignedOut,
  SignOutButton,
  useUser,
} from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";


export const Route = createFileRoute("/home")({
  component: Home,
});

function Home() {
  const { user } = useUser();

  return (
    <WebOnly>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <div className="h-screen w-full flex flex-col gap-2 justify-center items-center">
          <span className="w-[40%] min-w-[200px] max-w-[600px] text-center">
            You shouldn't be here, but now that you are, let me tell you that
            soon we'll be having agents that can run outside of your computer
            that'll be managed here.
          </span>

          <br />
          <Button>
            <SignOutButton />
          </Button>

          <span className="text-muted-foreground text-[14px]">
            logged in as {user?.primaryEmailAddress?.emailAddress}
          </span>
        </div>
      </SignedIn>
    </WebOnly>
  );
}
