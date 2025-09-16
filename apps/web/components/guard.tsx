import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useSignIn, useUser } from "@clerk/clerk-react";
import { toast } from "sonner";
import { Loader2, SettingsIcon } from "lucide-react";

export default function Guard() {
  const [state, setState] = useState<"none" | "waiting" | "setting">("none");
  const { signIn, setActive } = useSignIn();
  const { user } = useUser();

  const handleStart = () => {
    setState("waiting");
    window.api.auth.openLogin();
  };

  useEffect(() => {
    const remove = window.api.auth.onTokenReceived(async (ticket) => {
      console.log("ticket received: ", ticket);
      if (!signIn || !setActive || !ticket || user || state == "setting") {
        return;
      }

      setState("setting");

      try {
        // Create the `SignIn` with the token
        const signInAttempt = await signIn.create({
          strategy: "ticket",
          ticket: ticket as string,
        });

        // If the sign-in was successful, set the session to active
        if (signInAttempt.status === "complete") {
          setActive({
            session: signInAttempt.createdSessionId,
          });
        } else {
          // If the sign-in attempt is not complete, check why.
          // User may need to complete further steps.
          toast.error("Error authorising desktop application");
          console.error(JSON.stringify(signInAttempt, null, 2));
        }
      } catch (err) {
        // See https://clerk.com/docs/custom-flows/error-handling
        // for more info on error handling
        console.error("Error:", JSON.stringify(err, null, 2));
      }
    });
    return remove;
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col gap-2 items-center justify-center">
      <div className="h-[40px] w-[40px] rounded-[20px] bg-primary" />
      <br />
      <div className="flex flex-col text-center">
        <span className="text-2xl font-semibold max-w-[300px] tracking-tight">
          A home for the agents that help you work
        </span>
      </div>
      <br />
      <Button onClick={handleStart} className="w-[300px]">
        Continue to sign in
      </Button>

      {state === "none" ? (
        <span className="text-muted-foreground text-[14px]">
          Redirects to default browser
        </span>
      ) : state === "waiting" ? (
        <span className="flex flex-row items-center gap-2 text-muted-foreground text-[14px]">
          <Loader2 className="animate-spin w-4 h-4" />
          Waiting for authorisation
        </span>
      ) : (
        <span className="flex flex-row items-center gap-2 text-muted-foreground text-[14px]">
          <SettingsIcon className="w-4 h-4" />
          Authorising desktop application
        </span>
      )}
    </div>
  );
}
