import { SignIn } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-in/$")({
  component: Page,
});

function Page() {
  console.log(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
  console.log(import.meta.env.VITE_CLERK_SIGN_IN_URL);
  return (
    <div className="h-screen w-screen flex flex-col gap-2 justify-center items-center">
      <SignIn />
    </div>
  );
}
