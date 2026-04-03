import { data, redirect } from "react-router";

import { createOidcStateCookie } from "~/utils/oidc-state";

import type { Route } from "./+types/oidc-start";

export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    await context.auth.require(request);
    return redirect("/");
  } catch {}

  const service = context.oidc?.service;
  if (!service) {
    throw data("OIDC is not enabled or misconfigured", { status: 501 });
  }

  const result = await service.startFlow();
  if (!result.ok) {
    return redirect(`/login?s=${result.error.code}`);
  }

  const { url, flowState } = result.value;
  const cookie = createOidcStateCookie(context.config);

  return redirect(url, {
    status: 302,
    headers: {
      "Set-Cookie": await cookie.serialize({
        state: flowState.state,
        nonce: flowState.nonce,
        verifier: flowState.codeVerifier,
        redirect_uri: flowState.redirectUri,
      }),
    },
  });
}
