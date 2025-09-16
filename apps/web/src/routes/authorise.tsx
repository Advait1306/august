import { Button } from "@/components/ui/button";
import {
  RedirectToSignIn,
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
      <span>
        Do you want to authorise your local application with{" "}
        {user?.primaryEmailAddress?.emailAddress}?
      </span>
      <Button onClick={handleAuthorise}>Authorise</Button>
    </div>
  );
}
