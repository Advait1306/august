import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (window.electron) {
      throw redirect({
        to: "/tasks",
        search: {
          project: undefined,
          agent: undefined,
        },
      });
    } else {
      throw redirect({
        to: "/home",
      });
    }
  },
});
