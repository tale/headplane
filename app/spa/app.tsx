import { RouterProvider } from "@tanstack/react-router";
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
      <RouterProvider router={router} />
    </FateClient>
  );
}
