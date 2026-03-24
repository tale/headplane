import { createHash } from "node:crypto";

import * as oidc from "openid-client";
import { data, redirect } from "react-router";

import { findHeadscaleUserBySubject } from "~/server/web/headscale-identity";
import log from "~/utils/log";
import { createOidcStateCookie } from "~/utils/oidc-state";

import type { Route } from "./+types/oidc-callback";

export async function loader({ request, context }: Route.LoaderArgs) {
  const oidcConnector = await context.oidc?.connector.get();
  if (!oidcConnector?.isValid) {
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

  try {
    const callbackUrl = new URL(redirect_uri);
    const currentUrl = new URL(request.url);
    callbackUrl.search = currentUrl.search;

    const tokens = await oidc.authorizationCodeGrant(oidcConnector.client, callbackUrl, {
      expectedState: state,
      expectedNonce: nonce,
      ...(oidcConnector.usePKCE ? { pkceCodeVerifier: verifier } : {}),
    });

    const claims = tokens.claims();
    if (claims?.sub == null) {
      log.warn("auth", "No subject found in OIDC claims");
      return redirect("/login?s=error_no_sub");
    }

    const userInfo = await oidc.fetchUserInfo(
      oidcConnector.client,
      tokens.access_token,
      claims.sub,
    );

    // We have defaults that closely follow what Headscale uses, maybe we
    // can make it configurable in the future, but for now we only need the
    // `sub` claim.
    const username = userInfo.preferred_username ?? userInfo.email?.split("@")[0] ?? "user";
    const name =
      userInfo.name ??
      (userInfo.given_name && userInfo.family_name
        ? `${userInfo.given_name} ${userInfo.family_name}`
        : (userInfo.preferred_username ?? "SSO User"));

    const picture = await (async () => {
      if (context.config.oidc?.profile_picture_source === "gravatar") {
        if (!userInfo.email) {
          return undefined;
        }

        const emailHash = userInfo.email.trim().toLowerCase();
        const hash = createHash("sha256").update(emailHash).digest("hex");
        return `https://www.gravatar.com/avatar/${hash}?s=200&d=identicon&r=x`;
      }

      if (!userInfo.picture) {
        return undefined;
      }

      try {
        const response = await fetch(userInfo.picture, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType?.startsWith("image/")) {
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            return `data:${contentType};base64,${base64}`;
          }
        }
      } catch {}

      return userInfo.picture;
    })();

    const userId = await context.auth.findOrCreateUser(claims.sub, {
      name,
      email: userInfo.email,
    });

    try {
      const hsApi = context.hsApi.getRuntimeClient(context.oidc!.apiKey);
      const hsUsers = await hsApi.getUsers();
      const hsUser = findHeadscaleUserBySubject(hsUsers, claims.sub, userInfo.email);
      if (hsUser) {
        await context.auth.linkHeadscaleUser(userId, hsUser.id);
      }
    } catch (error) {
      log.warn("auth", "Failed to link Headscale user: %s", String(error));
    }

    return redirect("/", {
      headers: {
        "Set-Cookie": await context.auth.createOidcSession(userId, {
          name,
          email: userInfo.email,
          username,
          picture,
        }),
      },
    });
  } catch (error) {
    if (error instanceof oidc.ResponseBodyError) {
      log.error("auth", "Got an OIDC response error body: %s", JSON.stringify(error.cause));

      // Check for PKCE-related errors
      if (
        error.error.toLowerCase().includes("code_verifier") ||
        error.error.toLowerCase().includes("code verifier") ||
        error.error.toLowerCase().includes("pkce")
      ) {
        log.error(
          "auth",
          "PKCE error detected. Your OIDC provider may require PKCE to be enabled. Current setting: use_pkce=%s",
          oidcConnector.usePKCE,
        );

        if (!oidcConnector.usePKCE) {
          log.error(
            "auth",
            "Consider setting oidc.use_pkce=true in your configuration if your provider requires PKCE",
          );
        }
      }
    } else if (error instanceof oidc.AuthorizationResponseError) {
      log.error("auth", "Got an OIDC authorization response error: %s", error.error);
    } else if (error instanceof oidc.WWWAuthenticateChallengeError) {
      log.error("auth", "Got an OIDC WWW-Authenticate challenge error");
    } else if (error instanceof oidc.ClientError) {
      log.error(
        "auth",
        "Got an OIDC authorization client error: %s",
        error.cause instanceof Error ? error.cause.message : String(error.cause),
      );
    } else {
      log.error(
        "auth",
        "Got an OIDC error: %s",
        error instanceof Error && error.cause ? JSON.stringify(error.cause) : String(error),
      );
    }
    return redirect("/login?s=error_auth_failed");
  }
}
