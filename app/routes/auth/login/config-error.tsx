import { AlertCircle, CloudOff } from "lucide-react";

import Card from "~/components/card";
import Code from "~/components/code";
import Link from "~/components/link";
import type { OidcErrorCode } from "~/server/oidc/provider";

export function OidcDiscoveryFailedNotice() {
  return (
    <Card className="m-4 mb-4 max-w-md border border-yellow-500 sm:m-0 sm:mb-4">
      <div className="flex items-center justify-between gap-4">
        <Card.Title className="text-yellow-500">SSO Temporarily Unavailable</Card.Title>
        <CloudOff className="mb-2 h-6 w-6 text-yellow-500" />
      </div>
      <Card.Text className="text-sm">
        Unable to reach the identity provider. Single Sign-On will be available once the provider is
        reachable again. You can still sign in with an API key.
      </Card.Text>
    </Card>
  );
}

export function OidcConfigErrorNotice({ errors }: { errors: OidcErrorCode[] }) {
  return (
    <Card className="m-4 mb-4 max-w-md border border-red-500 sm:m-0 sm:mb-4">
      <div className="flex items-center justify-between gap-4">
        <Card.Title className="text-red-500">Authentication Error</Card.Title>
        <AlertCircle className="mb-2 h-6 w-6 text-red-500" />
      </div>
      <Card.Text className="text-sm">
        The OpenID Connect (OIDC) Single Sign-On (SSO) configuration has issues:{" "}
        <ul className="mt-2 mb-1 list-inside list-disc">
          {mapOidcErrorsToMessages(errors).map((code) => (
            <li key={code.key}>{code.node}</li>
          ))}
        </ul>{" "}
        <Link external styled to="https://headplane.net/configuration/sso#troubleshooting">
          Learn more
        </Link>
      </Card.Text>
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
            <Card.Text className="inline">
              The provided API key for OIDC authentication is invalid. Ensure that{" "}
              <Code>headscale.api_key</Code> is a valid API key.
            </Card.Text>
          ),
        });
        break;
      }

      case "missing_endpoints": {
        messages.push({
          key: error,
          node: (
            <Card.Text className="inline">
              The OIDC provider is missing required endpoints. Ensure the discovery URL is correct
              or provide manual endpoint overrides in your configuration.
            </Card.Text>
          ),
        });
        break;
      }

      case "discovery_failed": {
        messages.push({
          key: error,
          node: (
            <Card.Text className="inline">
              Unable to reach the OIDC provider for discovery. SSO will retry on the next login
              attempt.
            </Card.Text>
          ),
        });
        break;
      }

      default: {
        messages.push({
          key: error,
          node: (
            <Card.Text className="inline">
              An unknown OIDC configuration error occurred. Please check the Headplane logs for more
              information.
            </Card.Text>
          ),
        });
        break;
      }
    }
  }

  return messages;
}
