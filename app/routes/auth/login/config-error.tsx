import { AlertCircle, CloudOff } from "lucide-react";

import Card from "~/components/card";
import Code from "~/components/code";
import Link from "~/components/link";
import type { OidcErrorCode } from "~/server/oidc/provider";

export function OidcDiscoveryFailedNotice() {
  return (
    <Card className="border-warn m-4 mb-4 max-w-md border sm:m-0 sm:mb-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-warn mb-2 text-lg font-semibold">SSO Temporarily Unavailable</h2>
        <CloudOff className="text-warn mb-2 h-6 w-6" />
      </div>
      <p className="text-sm">
        Unable to reach the identity provider. Single Sign-On will be available once the provider is
        reachable again. You can still sign in with an API key.
      </p>
    </Card>
  );
}

export function OidcConfigErrorNotice({ errors }: { errors: OidcErrorCode[] }) {
  return (
    <Card className="border-bad m-4 mb-4 max-w-md border sm:m-0 sm:mb-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-bad mb-2 text-lg font-semibold">Authentication Error</h2>
        <AlertCircle className="text-bad mb-2 h-6 w-6" />
      </div>
      <p className="text-sm">
        The OpenID Connect (OIDC) Single Sign-On (SSO) configuration has issues:{" "}
        <ul className="mt-2 mb-1 list-inside list-disc">
          {mapOidcErrorsToMessages(errors).map((code) => (
            <li key={code.key}>{code.node}</li>
          ))}
        </ul>{" "}
        <Link external styled to="https://headplane.net/features/sso#troubleshooting">
          Learn more
        </Link>
      </p>
    </Card>
  );
}

function mapOidcErrorsToMessages(errors: OidcErrorCode[]) {
  const messages: {
    key: string;
    node: React.ReactNode;
  }[] = [];

  for (const error of errors) {
    switch (error) {
      case "invalid_api_key": {
        messages.push({
          key: error,
          node: (
            <p className="inline">
              The provided API key for OIDC authentication is invalid. Ensure that{" "}
              <Code>headscale.api_key</Code> is a valid API key.
            </p>
          ),
        });
        break;
      }

      case "missing_endpoints": {
        messages.push({
          key: error,
          node: (
            <p className="inline">
              The OIDC provider is missing required endpoints. Ensure the discovery URL is correct
              or provide manual endpoint overrides in your configuration.
            </p>
          ),
        });
        break;
      }

      case "discovery_failed": {
        messages.push({
          key: error,
          node: (
            <p className="inline">
              Unable to reach the OIDC provider for discovery. SSO will retry on the next login
              attempt.
            </p>
          ),
        });
        break;
      }

      default: {
        messages.push({
          key: error,
          node: (
            <p className="inline">
              An unknown OIDC configuration error occurred. Please check the Headplane logs for more
              information.
            </p>
          ),
        });
        break;
      }
    }
  }

  return messages;
}
