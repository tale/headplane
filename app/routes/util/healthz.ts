import { headscaleContext } from "~/server/context";

import type { Route } from "./+types/healthz";

export async function loader({ context }: Route.LoaderArgs) {
  const headscale = context.get(headscaleContext);

  const healthy = await headscale.health();

  return new Response(JSON.stringify({ status: healthy ? "OK" : "ERROR" }), {
    status: healthy ? 200 : 500,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
