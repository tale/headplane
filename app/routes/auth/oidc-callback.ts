import { data, redirect } from "react-router";

import { findHeadscaleUserBySubject } from "~/server/web/headscale-identity";
import { Roles } from "~/server/web/roles";
import log from "~/utils/log";
import { createOidcStateCookie } from "~/utils/oidc-state";

import type { Route } from "./+types/oidc-callback";

export async function loader({ request, context }: Route.LoaderArgs) {
  if (context.oidc.state !== "enabled") {
    throw data(`OIDC is unavailable: ${context.oidc.reason}`, { status: 501 });
  }
  const service = context.oidc.value;

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
  const claimedRole =
    identity.role && identity.role !== "owner" && identity.role in Roles
      ? identity.role
      : undefined;

  const userId = await context.auth.findOrCreateUser(
    identity.subject,
    {
      name: identity.name,
      email: identity.email,
      picture: identity.picture,
    },
    {
      initialRole: claimedRole ?? context.config.oidc?.default_role,
    },
  );

  try {
    // Looks up the Headscale user that matches this OIDC identity. We use
    // the configured admin API key here — not a per-request one — because
    // there is no per-request key yet (the session is being created).
    const hsApi = context.headscale.client(context.headscaleApiKey!);
    const hsUsers = await hsApi.users.list();
    const hsUser = findHeadscaleUserBySubject(hsUsers, identity.subject, identity.email);
    if (hsUser) {
      await context.auth.linkHeadscaleUser(userId, hsUser.id);
    }
  } catch (error) {
    log.warn("auth", "Failed to link Headscale user: %s", String(error));
  }

  // Only persist the id_token when RP-initiated logout is enabled — otherwise
  // we'd be storing a credential we never use.
  const idToken = context.config.oidc?.use_end_session ? identity.idToken : undefined;

  return redirect("/", {
    headers: {
      "Set-Cookie": await context.auth.createOidcSession(
        userId,
        {
          name: identity.name,
          email: identity.email,
          username: identity.username,
        },
        { idToken },
      ),
    },
  });
}
