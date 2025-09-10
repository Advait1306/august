import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [count, setCount] = useState(0);

  return (
    <div className="p-2">
      <h3>Testing a new change for cache miss</h3>
      <span>{count}</span>
      <button onClick={() => setCount(count + 1)}>increase</button>
    </div>
  );
}
