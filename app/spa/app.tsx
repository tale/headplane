import { RouterProvider } from "@tanstack/react-router";
import { FateClient, createClient, createHTTPTransport } from "react-fate";

import { router } from "./router";

const fate = createClient({
  roots: {},
  transport: createHTTPTransport({
    fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
    url: `${__PREFIX__}/fate`,
  }),
  types: [],
});

export function App() {
  return (
    <FateClient client={fate}>
      <RouterProvider router={router} />
    </FateClient>
  );
}
