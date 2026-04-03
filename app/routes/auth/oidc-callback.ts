import { data, redirect } from "react-router";

import { findHeadscaleUserBySubject } from "~/server/web/headscale-identity";
import log from "~/utils/log";
import { createOidcStateCookie } from "~/utils/oidc-state";

import type { Route } from "./+types/oidc-callback";

export async function loader({ request, context }: Route.LoaderArgs) {
  const service = context.oidc?.service;
  if (!service) {
    throw data("OIDC is not enabled or misconfigured", { status: 501 });
  }

  const url = new URL(request.url);
  if (url.searchParams.toString().length === 0) {
    return redirect("/login?s=error_no_query");
  }

  const cookie = createOidcStateCookie(context.config);
  const oidcCookieState = await cookie.parse(request.headers.get("Cookie"));

  if (oidcCookieState == null) {
    log.warn("auth", "Called OIDC callback without session cookie");
    return redirect("/login?s=error_no_session");
  }

  const { state, nonce, redirect_uri, verifier } = oidcCookieState;
  if (!state || !nonce || !redirect_uri || !verifier) {
    log.warn("auth", "OIDC session cookie is missing required fields");
    return redirect("/login?s=error_invalid_session");
  }

  const flowState = {
    state,
    nonce,
    codeVerifier: verifier,
    redirectUri: redirect_uri,
  };

  const result = await service.handleCallback(url.searchParams, flowState);
  if (!result.ok) {
    log.error("auth", "OIDC callback failed [%s]: %s", result.error.code, result.error.message);
    if (result.error.hint) {
      log.error("auth", "Hint: %s", result.error.hint);
    }
    return redirect("/login?s=error_auth_failed");
  }

  const identity = result.value;

  const userId = await context.auth.findOrCreateUser(identity.subject, {
    name: identity.name,
    email: identity.email,
    picture: identity.picture,
  });

  try {
    const hsApi = context.hsApi.getRuntimeClient(context.headscaleApiKey!);
    const hsUsers = await hsApi.getUsers();
    const hsUser = findHeadscaleUserBySubject(hsUsers, identity.subject, identity.email);
    if (hsUser) {
      await context.auth.linkHeadscaleUser(userId, hsUser.id);
    }
  } catch (error) {
    log.warn("auth", "Failed to link Headscale user: %s", String(error));
  }

  return redirect("/", {
    headers: {
      "Set-Cookie": await context.auth.createOidcSession(userId, {
        name: identity.name,
        email: identity.email,
        username: identity.username,
      }),
    },
  });
}
