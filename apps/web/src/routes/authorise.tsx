import { Button } from "@/components/ui/button";
import {
  RedirectToSignIn,
  SignedIn,
  SignedOut,
  useAuth,
  useUser,
} from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/authorise")({
  component: Page,
});

function Page() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useAuth();

  const handleAuthorise = async () => {
    const authToken = await getToken();
    if (authToken) {
      try {
        const response = await fetch("http://localhost:8080/ticket", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (response.ok) {
          console.log("Authorization successful");
          const data = await response.json();
          window.location.href = `jupiter://authorise?ticket=${data.ticket}`;
        } else {
          console.error("Authorization failed:", response.status);
        }
      } catch (error) {
        console.error("Error during authorization:", error);
      }
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col gap-2 justify-center items-center">
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <div className="w-[30%] h-[40%] min-w-[400px] max-w-[500px] rounded-xl flex flex-col bg-secondary overflow-hidden">
          <div className="h-[50%] w-full bg-amber-600"></div>
          <div className="h-[50%] w-full flex flex-col justify-center gap-4 px-12 text-center">
            <span>
              Do you want to authorise Jupiter with {""}
              {user?.primaryEmailAddress?.emailAddress}?
            </span>
            <div className="flex flex-col gap-2">
              <Button onClick={handleAuthorise}>Authorise</Button>
            </div>
          </div>
        </div>
        <Button
          variant={"link"}
          onClick={() => signOut()}
          className="text-muted-foreground text-[12px]"
        >
          Login with a different account
        </Button>
      </SignedIn>
    </div>
  );
}
