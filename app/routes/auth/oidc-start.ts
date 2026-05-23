import { data, redirect } from "react-router";

import { createOidcStateCookie } from "~/utils/oidc-state";

import type { Route } from "./+types/oidc-start";

export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    await context.auth.require(request);
    return redirect("/");
  } catch {}

  if (context.oidc.state !== "enabled") {
    throw data(`OIDC is unavailable: ${context.oidc.reason}`, { status: 501 });
  }
  const service = context.oidc.value;

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
