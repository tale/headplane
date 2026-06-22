import { data, redirect } from "react-router";

import { appConfigContext, authContext, oidcContext } from "~/server/context";
import { logOidcError } from "~/server/oidc/provider";
import { createOidcStateCookie } from "~/utils/oidc-state";

import type { Route } from "./+types/oidc-start";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const oidc = context.get(oidcContext);

  try {
    await auth.require(request);
    return redirect("/");
  } catch {}

  if (oidc.state !== "enabled") {
    throw data(`OIDC is unavailable: ${oidc.reason}`, { status: 501 });
  }
  const service = oidc.value;

  const result = await service.startFlow();
  if (!result.ok) {
    logOidcError("OIDC start failed", result.error);
    return redirect(`/login?s=${result.error.code}`);
  }

  const { url, flowState } = result.value;
  const cookie = createOidcStateCookie(config);

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
