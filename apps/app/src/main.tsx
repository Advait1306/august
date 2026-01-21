import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import * as Sentry from "@sentry/react";
import "./index.css";

// Initialize Sentry for error tracking
Sentry.init({
  dsn: "https://9d87ba0a2f4279c02f059509b276419d@o4510748532342784.ingest.us.sentry.io/4510748533194752",
  sendDefaultPii: true,
  enableLogs: true,
});

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Manually preload specific routes
if (window.electron) {
  // Only preload routes if in electron shell
  router.preloadRoute({
    to: "/tasks",
    search: { project: undefined, agent: undefined },
  });
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}
