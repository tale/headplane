import { RouterProvider } from "@tanstack/react-router";
import { Suspense } from "react";
import { FateClient } from "react-fate";
import { createFateClient } from "react-fate/client";

import { router } from "./router";

const fate = createFateClient({
  fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
  url: `${__PREFIX__}/fate`,
});

export function App() {
  return (
    <FateClient client={fate}>
      <Suspense
        fallback={<div className="min-h-screen bg-neutral-950 p-6 text-neutral-400">Loading…</div>}
      >
        <RouterProvider router={router} />
      </Suspense>
    </FateClient>
  );
}
