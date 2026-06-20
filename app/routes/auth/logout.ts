import { type ActionFunctionArgs, redirect } from "react-router";

import { appConfigContext, authContext, oidcContext } from "~/server/context";

export async function loader() {
  return redirect("/machines");
}

export async function action({ request, context }: ActionFunctionArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const oidc = context.get(oidcContext);

  let principal: Awaited<ReturnType<typeof auth.require>> | undefined;
  try {
    principal = await auth.require(request);
  } catch {
    return redirect("/login");
  }

  // When API key is disabled, we need to explicitly redirect
  // with a logout state to prevent auto login again.
  let url = config.oidc?.disable_api_key_login ? "/login?s=logout" : "/login";

  // For OIDC sessions, redirect to the provider's RP-initiated logout
  // endpoint when explicitly enabled, so the upstream IdP session is also
  // ended. Disabled by default because the post_logout_redirect_uri must be
  // pre-registered on the IdP — turning this on without registering it would
  // strand users on the IdP's error page.
  if (principal?.kind === "oidc" && oidc.state === "enabled" && config.oidc?.use_end_session) {
    const service = oidc.value;
    const status = service.status();
    if (status.state !== "ready") {
      // Trigger discovery if it hasn't happened yet so we can find the
      // end_session_endpoint without forcing a re-login.
      await service.discover();
    }

    const endSessionUrl = service.buildEndSessionUrl(principal.idToken);
    if (endSessionUrl) {
      url = endSessionUrl;
    }
  }

  return redirect(url, {
    headers: {
      "Set-Cookie": await auth.destroySession(request),
    },
  });
}
