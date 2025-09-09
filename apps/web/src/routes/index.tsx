import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const router = useRouter();

  useEffect(() => {
    const preloadAllRoutes = async () => {
      try {
        await Promise.all([
          // Static routes
          router.preloadRoute({ to: "/" }),
          router.preloadRoute({ to: "/posts" }),
          router.preloadRoute({ to: "/users" }),
          router.preloadRoute({ to: "/deferred" }),
          router.preloadRoute({ to: "/redirect" }),
          router.preloadRoute({ to: "/route-a" }),
          router.preloadRoute({ to: "/route-b" }),
        ]);
      } catch (err) {
        console.warn("Some routes failed to preload:", err);
      }
    };

    preloadAllRoutes();
  }, [router]);

  return (
    <div className="p-2">
      <h3>Welcome Home!!! Updated this page! AGAIN</h3>
    </div>
  );
}
