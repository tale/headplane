import * as oidc from "openid-client";
import { data, redirect } from "react-router";

import { HeadplaneConfig } from "~/server/config/config-schema";
import { createOidcStateCookie } from "~/utils/oidc-state";

import type { Route } from "./+types/oidc-start";

export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    await context.sessions.auth(request);
    return redirect("/");
  } catch {}

  const oidcConnector = await context.oidcConnector?.get();
  if (!oidcConnector?.isValid) {
    throw data("OIDC is not enabled or misconfigured", { status: 501 });
  }

  const cookie = createOidcStateCookie(context.config);
  const redirect_uri = getRedirectUri(context.config, request);

  const nonce = oidc.randomNonce();
  const verifier = oidc.randomPKCECodeVerifier();
  const state = oidc.randomState();

  const url = oidc.buildAuthorizationUrl(oidcConnector.client, {
    ...oidcConnector.extraParams,
    scope: oidcConnector.scope,
    redirect_uri,
    state,
    nonce,
    ...(oidcConnector.usePKCE
      ? {
          code_challenge_method: "S256",
          code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        }
      : {}),
  });

  return redirect(url.href, {
    status: 302,
    headers: {
      "Set-Cookie": await cookie.serialize({
        state,
        nonce,
        verifier,
        redirect_uri,
      }),
    },
  });
}

function getRedirectUri(config: HeadplaneConfig, req: Request): string {
  if (config.server.base_url != null) {
    const url = new URL(`${__PREFIX__}/oidc/callback`, config.server.base_url);
    return url.href;
  }

  if (config.oidc?.redirect_uri != null) {
    const url = new URL(`${__PREFIX__}/oidc/callback`, config.oidc.redirect_uri);
    return url.href;
  }

  const url = new URL(`${__PREFIX__}/oidc/callback`, req.url);
  let host = req.headers.get("Host");
  if (!host) {
    host = req.headers.get("X-Forwarded-Host");
  }

  if (!host) {
    throw data("Cannot determine redirect URI: no Host or X-Forwarded-Host header", {
      status: 500,
    });
  }

  const proto = req.headers.get("X-Forwarded-Proto");
  url.protocol = proto ?? "http:";
  url.host = host;
  return url.href;
}
