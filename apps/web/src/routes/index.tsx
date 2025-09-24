import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (window.electron) {
      redirect({
        to: "/tasks",
        search: {
          project: undefined,
          agent: undefined,
        },
      });
    } else {
      redirect({
        to: "/home",
      });
    }
  },
});
