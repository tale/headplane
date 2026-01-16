import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Form, Link as RemixLink, redirect, useSearchParams } from "react-router";

import Button from "~/components/Button";
import Card from "~/components/Card";
import Code from "~/components/Code";
import Input from "~/components/Input";
import Link from "~/components/Link";
import { useLiveData } from "~/utils/live-data";

import type { Route } from "./+types/page";

import { loginAction } from "./action";
import { OidcConfigErrorNotice, OidcDiscoveryFailedNotice } from "./config-error";
import Logout from "./logout";
import { OidcErrorNotice } from "./oidc-error";

export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    await context.sessions.auth(request);
    return redirect("/machines");
  } catch {}

  const qp = new URL(request.url).searchParams;
  const urlState = qp.get("s") ?? undefined;

  const oidcConnector = await context.oidcConnector?.get();

  // MARK: This works because the OIDC connector will always return false
  // for `isExclusive` if the OIDC config isn't usable.
  if (oidcConnector?.isExclusive && urlState !== "logout") {
    return redirect("/oidc/start");
  }

  const isOidcConnectorEnabled = oidcConnector?.isValid;
  const oidcErrorCodes = !isOidcConnectorEnabled ? (oidcConnector?.errors ?? []) : [];

  return {
    isCookieSecureEnabled: context.config.server.cookie_secure,
    isOidcConnectorEnabled,
    oidcErrorCodes,
    urlState,
  };
}

export const action = loginAction;

export default function Page({ loaderData, actionData }: Route.ComponentProps) {
  const { isCookieSecureEnabled, isOidcConnectorEnabled, oidcErrorCodes, urlState } = loaderData;

  const [showCookieWarning, setShowCookieWarning] = useState(false);
  const [params] = useSearchParams();
  const { pause } = useLiveData();

  useEffect(() => {
    // This page does NOT need stale while revalidate logic
    pause();

    if (isCookieSecureEnabled && window.location.protocol !== "https:") {
      setShowCookieWarning(true);
    }
  });

  useEffect(() => {
    // State is a one time thing, we need to remove it after it has
    // been consumed to prevent logic loops.
    if (urlState !== null) {
      const searchParams = new URLSearchParams(params);
      searchParams.delete("s");

      // Replacing because it's not a navigation, just a cleanup of the URL
      // We can't use the useSearchParams method since it revalidates
      // which will trigger a full reload
      const newUrl = searchParams.toString()
        ? `{${window.location.pathname}?${searchParams.toString()}`
        : window.location.pathname;

      window.history.replaceState(null, "", newUrl);
    }
  }, [urlState, params]);

  if (urlState === "logout") {
    return <Logout />;
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div>
        {urlState?.startsWith("error_") ? (
          <OidcErrorNotice code={urlState} />
        ) : oidcErrorCodes.includes("DISCOVERY_FAILED") ? (
          <OidcDiscoveryFailedNotice />
        ) : oidcErrorCodes.length > 0 ? (
          <OidcConfigErrorNotice errors={oidcErrorCodes} />
        ) : showCookieWarning ? (
          <Card className="m-4 mb-4 max-w-md border border-red-500 sm:m-0 sm:mb-4">
            <div className="flex items-center justify-between gap-4">
              <Card.Title className="text-red-500">Configuration Issue</Card.Title>
              <AlertCircle className="mb-2 h-6 w-6 text-red-500" />
            </div>
            {showCookieWarning ? (
              <Card.Text className="text-sm">
                Headplane is configured to use secure cookies, but this site is being served over an
                insecure connection and login will not work correctly.{" "}
                <Link
                  name="Headplane Common Issues"
                  to="https://headplane.net/configuration/common-issues#issue-logging-in-does-not-do-anything"
                >
                  Learn more.
                </Link>
              </Card.Text>
            ) : undefined}
          </Card>
        ) : undefined}
        <Card className="m-4 max-w-md sm:m-0">
          <Card.Title>Welcome to Headplane</Card.Title>
          <Form method="POST">
            <Card.Text>
              Enter an API key to authenticate with Headplane. You can generate one by running{" "}
              <Code>headscale apikeys create</Code> in your terminal.
            </Card.Text>
            <Input
              className="mt-8 mb-2"
              isRequired
              label="API Key"
              labelHidden
              name="api_key"
              placeholder="API Key"
              type="password"
            />
            {actionData?.success === false ? (
              <Card.Text className="mb-2 text-sm text-red-600 dark:text-red-300">
                {actionData.message}
              </Card.Text>
            ) : undefined}
            <Button className="w-full" type="submit" variant="heavy">
              Sign In
            </Button>
          </Form>
          {isOidcConnectorEnabled ? (
            <RemixLink to="/oidc/start">
              <Button
                className="mt-2 w-full"
                isDisabled={oidcErrorCodes.length > 0}
                variant="light"
              >
                Single Sign-On
              </Button>
            </RemixLink>
          ) : undefined}
        </Card>
      </div>
    </div>
  );
}
