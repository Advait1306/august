import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useSignIn, useUser } from "@clerk/clerk-react";
import { toast } from "sonner";
import { Clock, Loader2, SettingsIcon } from "lucide-react";

type GuardState = "none" | "waiting" | "setting" | "waitlisted";

export default function Guard() {
  const [state, setState] = useState<GuardState>("none");
  const { signIn, setActive } = useSignIn();
  const { user } = useUser();

  const handleStart = () => {
    setState("waiting");
    window.api.auth.openLogin();
  };

  const openWaitlist = () => {
    window.open("https://august.tech/waitlist", "_blank");
  };

  const isWaitlistError = (err: unknown): boolean => {
    if (!err || typeof err !== "object") return false;
    const error = err as { errors?: Array<{ code?: string; message?: string }> };
    const errorCode = error.errors?.[0]?.code;
    const errorMessage = error.errors?.[0]?.message?.toLowerCase() || "";
    return (
      errorCode === "user_not_approved" ||
      errorCode === "waitlist_pending" ||
      errorMessage.includes("waitlist") ||
      errorMessage.includes("not approved")
    );
  };

  useEffect(() => {
    // Workaround to add auth to development mode
    if (import.meta.env.DEV) {
      // @ts-ignore
      window.setAuth = async (ticket: string) => {
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
          if (isWaitlistError(err)) {
            setState("waitlisted");
          } else {
            setState("none");
            toast.error("Sign in failed. Please try again.");
          }
        }
      };
    }
  }, []);

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
        if (isWaitlistError(err)) {
          setState("waitlisted");
        } else {
          setState("none");
          toast.error("Sign in failed. Please try again.");
        }
      }
    });
    return remove;
  }, [signIn, setActive, user, state]);

  // Waitlisted state UI
  if (state === "waitlisted") {
    return (
      <div className="h-screen w-screen flex flex-col gap-2 items-center justify-center">
        <div className="h-[40px] w-[40px] rounded-[20px] bg-primary flex items-center justify-center">
          <Clock className="w-5 h-5 text-primary-foreground" />
        </div>
        <br />
        <div className="flex flex-col text-center max-w-[350px]">
          <span className="text-2xl font-semibold tracking-tight">
            You&apos;re on the waitlist
          </span>
          <span className="text-muted-foreground text-[14px] mt-2">
            Thanks for your interest in August! We&apos;ll send you an email
            when your access is approved.
          </span>
        </div>
        <br />
        <Button onClick={openWaitlist} variant="outline" className="w-[300px]">
          Check waitlist status
        </Button>
        <Button
          onClick={() => setState("none")}
          variant="ghost"
          className="w-[300px]"
        >
          Try different account
        </Button>
      </div>
    );
  }

  // Default sign-in flow UI
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

      <div className="mt-8">
        <Button
          onClick={openWaitlist}
          variant="link"
          className="text-muted-foreground text-[12px]"
        >
          Don&apos;t have access? Join the waitlist
        </Button>
      </div>
    </div>
  );
}
