import { SignUp } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-up/$")({
  component: Page,
});

function Page() {
  return (
    <div className="h-screen w-screen flex flex-col gap-2 justify-center items-center">
      <SignUp />
    </div>
  );
}
