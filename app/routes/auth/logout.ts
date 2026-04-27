import { type ActionFunctionArgs, redirect } from "react-router";

import type { AppContext } from "~/server/context";

export async function loader() {
  return redirect("/machines");
}

export async function action({ request, context }: ActionFunctionArgs<AppContext>) {
  let principal: Awaited<ReturnType<typeof context.auth.require>> | undefined;
  try {
    principal = await context.auth.require(request);
  } catch {
    return redirect("/login");
  }

  // When API key is disabled, we need to explicitly redirect
  // with a logout state to prevent auto login again.
  let url = context.config.oidc?.disable_api_key_login ? "/login?s=logout" : "/login";

  // For OIDC sessions, redirect to the provider's RP-initiated logout
  // endpoint when explicitly enabled, so the upstream IdP session is also
  // ended. Disabled by default because the post_logout_redirect_uri must be
  // pre-registered on the IdP — turning this on without registering it would
  // strand users on the IdP's error page.
  if (principal?.kind === "oidc" && context.oidc?.useEndSession && context.oidc.service) {
    const status = context.oidc.service.status();
    if (status.state !== "ready") {
      // Trigger discovery if it hasn't happened yet so we can find the
      // end_session_endpoint without forcing a re-login.
      await context.oidc.service.discover();
    }

    const endSessionUrl = context.oidc.service.buildEndSessionUrl(principal.idToken);
    if (endSessionUrl) {
      url = endSessionUrl;
    }
  }

  return redirect(url, {
    headers: {
      "Set-Cookie": await context.auth.destroySession(request),
    },
  });
}
