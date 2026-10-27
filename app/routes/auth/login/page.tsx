import { useEffect, useState } from "react";
import { Form, Link as RouterLink, redirect, useNavigation, useSearchParams } from "react-router";

import Button from "~/components/button";
import Callout from "~/components/callout";
import Code from "~/components/code";
import Input from "~/components/input";
import Link from "~/components/link";
import { appConfigContext, authContext, oidcContext } from "~/server/context";
import type { OidcError, OidcService } from "~/server/oidc/provider";
import { useLiveData } from "~/utils/live-data";
import log from "~/utils/log";

import type { Route } from "./+types/page";
import { loginAction } from "./action";
import { OidcConfigErrorNotice, OidcDiscoveryFailedNotice } from "./config-error";
import Logout from "./logout";
import { OidcErrorNotice } from "./oidc-error";
import Shell from "./shell";

export async function loader({ request, context, url }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const oidc = context.get(oidcContext);

  try {
    await auth.require(request);
    return redirect("/machines");
  } catch {}

  const qp = url.searchParams;
  const urlState = qp.get("s") ?? undefined;

  const oidcService = oidc.state === "enabled" ? oidc.value : undefined;
  let oidcStatus: ReturnType<OidcService["status"]> | undefined;
  if (oidcService) {
    try {
      const result = await oidcService.discover();
      if (!result.ok) {
        logLoginOidcError("OIDC discovery failed", result.error);
      }
    } catch (error) {
      log.error("auth", "OIDC discovery failed unexpectedly: %s", String(error));
      log.debug("auth", "OIDC discovery error details: %o", error);
    }

    oidcStatus = oidcService.status();
  }

  if (
    oidcService &&
    config.oidc?.disable_api_key_login &&
    oidcStatus?.state === "ready" &&
    urlState !== "logout"
  ) {
    return redirect("/oidc/start");
  }

  const isOidcConnectorEnabled = oidcStatus?.state === "ready";
  const oidcErrorCodes = oidcStatus?.state === "error" ? [oidcStatus.error.code] : [];

  return {
    isCookieSecureEnabled: config.server.cookie_secure,
    isOidcConnectorEnabled,
    oidcErrorCodes,
    urlState,
  };
}

export const action = loginAction;

function logLoginOidcError(context: string, error: OidcError): void {
  log.error("auth", "%s [%s]: %s", context, error.code, error.message);
  if (error.hint) {
    log.error("auth", "Hint: %s", error.hint);
  }
}

export default function Page({ loaderData, actionData }: Route.ComponentProps) {
  const { isCookieSecureEnabled, isOidcConnectorEnabled, oidcErrorCodes, urlState } = loaderData;

  const [showCookieWarning, setShowCookieWarning] = useState(false);
  const [params] = useSearchParams();
  const { pause, resume } = useLiveData();
  const navigation = useNavigation();

  // There's no session to stream live data with until sign-in finishes.
  useEffect(() => {
    pause();
    return resume;
  }, [pause, resume]);

  useEffect(() => {
    if (isCookieSecureEnabled && window.location.protocol !== "https:") {
      setShowCookieWarning(true);
    }
  }, [isCookieSecureEnabled]);

  useEffect(() => {
    // State is a one time thing, we need to remove it after it has
    // Been consumed to prevent logic loops. The logout marker stays so a
    // reload doesn't auto-redirect into OIDC and silently sign back in.
    if (urlState !== undefined && urlState !== "logout") {
      const searchParams = new URLSearchParams(params);
      searchParams.delete("s");

      // Replacing because it's not a navigation, just a cleanup of the URL
      // We can't use the useSearchParams method since it revalidates
      // Which will trigger a full reload
      const newUrl = searchParams.toString()
        ? `${window.location.pathname}?${searchParams.toString()}`
        : window.location.pathname;

      window.history.replaceState(null, "", newUrl);
    }
  }, [urlState, params]);

  if (urlState === "logout") {
    return <Logout />;
  }

  const notice = urlState?.startsWith("error_") ? (
    <OidcErrorNotice code={urlState} />
  ) : oidcErrorCodes.includes("discovery_failed") ? (
    <OidcDiscoveryFailedNotice />
  ) : oidcErrorCodes.length > 0 ? (
    <OidcConfigErrorNotice errors={oidcErrorCodes} />
  ) : showCookieWarning ? (
    <Callout className="mb-6" title="Sign-in won't work over HTTP" variant="error">
      Headplane is set to use secure cookies, but this page was loaded over an insecure connection.{" "}
      <Link external styled to="https://headplane.net/troubleshooting#signing-in-does-nothing">
        Docs
      </Link>
    </Callout>
  ) : undefined;

  return (
    <Shell title="Sign in to Headplane">
      {notice}
      {isOidcConnectorEnabled && (
        <>
          <Button
            className="w-full"
            nativeButton={false}
            render={<RouterLink prefetch="none" reloadDocument to="/oidc/start" />}
            variant="primary"
          >
            Continue with SSO
          </Button>
          <div className="text-muted my-6 flex items-center gap-3 text-xs">
            <span className="bg-line h-px flex-1" />
            or
            <span className="bg-line h-px flex-1" />
          </div>
        </>
      )}
      <Form className="flex flex-col gap-3" method="POST">
        <Input
          autoComplete="current-password"
          errorMessage={actionData?.success === false ? actionData.message : undefined}
          invalid={actionData?.success === false}
          label="API key"
          labelTooltip={
            <>
              Create one by running{" "}
              <Code className="whitespace-nowrap">headscale apikeys create</Code> on your Headscale
              server.
            </>
          }
          name="api_key"
          placeholder="hskey-api-…"
          required
          type="password"
        />
        <Button
          className="w-full"
          pending={navigation.state === "submitting"}
          type="submit"
          variant={isOidcConnectorEnabled ? "secondary" : "primary"}
        >
          Sign in with API key
        </Button>
      </Form>
    </Shell>
  );
}
