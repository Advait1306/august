import { WebOnly } from "@/components/restrictor";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn, SignedOut, SignOutButton } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/home")({
  component: Home,
});

function Home() {
  return (
    <WebOnly>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <div className="h-screen w-full flex flex-col justify-center items-center">
        <span className="w-[40%] min-w-[200px] max-w-[500px] text-center">
          You shouldn't be here, but now that you are, tell me how you got here
          by sending an email to advait@sixhuman.com
        </span>

        <Button>
          <SignOutButton />
        </Button>
      </div>
    </WebOnly>
  );
}
