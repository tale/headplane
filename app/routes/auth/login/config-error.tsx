import { AlertCircle, CloudOff } from "lucide-react";

import Card from "~/components/Card";
import Code from "~/components/Code";
import Link from "~/components/Link";
import { OidcConnectorError } from "~/server/web/oidc-connector";

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

export function OidcConfigErrorNotice({ errors }: { errors: OidcConnectorError[] }) {
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
        <Link
          name="Headplane OIDC Issues"
          to="https://headplane.net/configuration/sso#troubleshooting"
        >
          Learn more
        </Link>
      </Card.Text>
    </Card>
  );
}

function mapOidcErrorsToMessages(errors: OidcConnectorError[]) {
  const messages: {
    key: string;
    node: React.ReactNode;
  }[] = [];

  for (const error of errors) {
    switch (error) {
      case "INVALID_API_KEY":
        messages.push({
          key: error,
          node: (
            <Card.Text className="inline">
              The provided API key for OIDC authentication is invalid. Ensure that{" "}
              <Code>oidc.headscale_api_key</Code> is a valid API key.
            </Card.Text>
          ),
        });
        break;

      case "MISSING_AUTHORIZATION_ENDPOINT":
        messages.push({
          key: error,
          node: (
            <Card.Text className="inline">
              The OIDC provided does not have a configured <Code>authorization_endpoint</Code>.
              Ensure discovery URL or manual configuration is correct.
            </Card.Text>
          ),
        });
        break;

      case "MISSING_TOKEN_ENDPOINT":
        messages.push({
          key: error,
          node: (
            <Card.Text className="inline">
              The OIDC provided does not have a configured <Code>token_endpoint</Code>. Ensure
              discovery URL or manual configuration is correct.
            </Card.Text>
          ),
        });
        break;

      case "MISSING_USERINFO_ENDPOINT":
        messages.push({
          key: error,
          node: (
            <Card.Text className="inline">
              The OIDC provided does not have a configured <Code>user_endpoint</Code>. Ensure
              discovery URL or manual configuration is correct.
            </Card.Text>
          ),
        });
        break;

      case "MISSING_REQUIRED_CLAIMS":
        messages.push({
          key: error,
          node: (
            <Card.Text className="inline">
              The OIDC provider does not support the <Code>sub</Code> claim, which is required for
              authentication. Your OIDC provider may be misconfigured.
            </Card.Text>
          ),
        });
        break;

      case "UNKNOWN_ERROR":
        messages.push({
          key: error,
          node: (
            <Card.Text className="inline">
              An unknown error occurred during OIDC configuration. Please check the Headplane logs
              for more information.
            </Card.Text>
          ),
        });
        break;
    }
  }

  return messages;
}
