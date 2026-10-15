import Callout from "~/components/callout";
import Code from "~/components/code";
import Link from "~/components/link";
import type { OidcErrorCode } from "~/server/oidc/provider";

export function OidcDiscoveryFailedNotice() {
  return (
    <Callout className="mb-6" title="Single sign-on is unavailable" variant="warning">
      Headplane can't reach your identity provider right now. You can still sign in with an API key.
    </Callout>
  );
}

export function OidcConfigErrorNotice({ errors }: { errors: OidcErrorCode[] }) {
  return (
    <Callout className="mb-6" title="Single sign-on is misconfigured" variant="error">
      <ul className="list-inside list-disc">
        {mapOidcErrorsToMessages(errors).map((code) => (
          <li key={code.key}>{code.node}</li>
        ))}
      </ul>
      <Link external styled to="https://headplane.net/features/sso#troubleshooting">
        Troubleshooting
      </Link>
    </Callout>
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
            <span>
              The provided API key for OIDC authentication is invalid. Ensure that{" "}
              <Code>headscale.api_key</Code> is a valid API key.
            </span>
          ),
        });
        break;
      }

      case "missing_endpoints": {
        messages.push({
          key: error,
          node: (
            <span>
              The OIDC provider is missing required endpoints. Ensure the discovery URL is correct
              or provide manual endpoint overrides in your configuration.
            </span>
          ),
        });
        break;
      }

      case "discovery_failed": {
        messages.push({
          key: error,
          node: (
            <span>
              Unable to reach the OIDC provider for discovery. SSO will retry on the next login
              attempt.
            </span>
          ),
        });
        break;
      }

      default: {
        messages.push({
          key: error,
          node: (
            <span>
              An unknown OIDC configuration error occurred. Please check the Headplane logs for more
              information.
            </span>
          ),
        });
        break;
      }
    }
  }

  return messages;
}
