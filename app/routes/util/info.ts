import { versions } from "node:process";

import { data } from "react-router";

import { appConfigContext, headscaleContext } from "~/server/context";

import type { Route } from "./+types/info";

export async function loader({ request, context }: Route.LoaderArgs) {
  const config = context.get(appConfigContext);
  const headscale = context.get(headscaleContext);

  if (config.server.info_secret == null) {
    throw data(
      {
        status: "Forbidden",
      },
      403,
    );
  }

  const bearer = request.headers.get("Authorization") ?? "";
  if (!bearer.startsWith("Bearer ")) {
    throw data(
      {
        status: "Unauthorized",
      },
      401,
    );
  }

  const token = bearer.slice("Bearer ".length).trim();
  if (token !== config.server.info_secret) {
    throw data(
      {
        status: "Forbidden",
      },
      403,
    );
  }

  const healthy = await headscale.health();

  const body = {
    status: healthy ? "healthy" : "unhealthy",
    headplane_version: __VERSION__,
    headscale_canonical_version: healthy ? headscale.version.raw : "unknown",
    internal_versions: {
      node: versions.node,
      v8: versions.v8,
      uv: versions.uv,
      zlib: versions.zlib,
      openssl: versions.openssl,
      libc: versions.libc,
    },
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
