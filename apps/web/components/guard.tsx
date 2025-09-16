import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useSignIn, useUser } from "@clerk/clerk-react";

export default function Guard() {
  const [loading, setLoading] = useState<boolean>(false);
  const { signIn, setActive } = useSignIn();
  const { user } = useUser();

  const handleStart = () => {
    window.api.auth.openLogin();
  };

  useEffect(() => {
    const remove = window.api.auth.onTokenReceived(async (ticket) => {
      if (!signIn || !setActive || !ticket || user || loading) {
        return;
      }

      try {
        setLoading(true);
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
          console.error(JSON.stringify(signInAttempt, null, 2));
        }
      } catch (err) {
        // See https://clerk.com/docs/custom-flows/error-handling
        // for more info on error handling
        console.error("Error:", JSON.stringify(err, null, 2));
      } finally {
        setLoading(false);
      }
      
    });
    return remove;
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center">
      <span>Get started with agents by logging in</span>
      <Button onClick={handleStart}>Start login</Button>
    </div>
  );
}
