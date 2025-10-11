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
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_URL}/ticket`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (response.ok) {
          console.log("Authorization successful");
          const data = await response.json();
          window.location.href = `august://authorise?ticket=${data.ticket}`;
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
        <div className="w-[30%] h-[40%] min-w-[400px] max-w-[500px] rounded-xl flex flex-col bg-secondary overflow-hidden border">
          <div className="h-[50%] overflow-hidden mx-4 mt-4">
            <img src="auth_image.png" />
          </div>
          <div className="h-[50%] w-full bg-muted flex flex-col justify-center gap-4 px-12 text-center">
            <span>
              Do you want to authorise August with {""}
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
