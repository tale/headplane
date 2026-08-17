import { AlertCircle } from "lucide-react";

import Card from "~/components/card";
import Code from "~/components/code";

/**
 * Explains why an identity-aware proxy assertion was not accepted.
 *
 * Deliberately describes the failure without echoing the assertion's claims.
 * The full detail — including the audience the assertion actually carried —
 * goes to the Headplane log, which an operator can read and an anonymous
 * visitor cannot.
 */
export function JwtAuthErrorNotice({ code }: { code: string }) {
  return (
    <Card className="m-4 mb-4 max-w-md border border-red-500 sm:m-0 sm:mb-4">
      <div className="flex items-center justify-between gap-4">
        <Card.Title className="text-red-500">Proxy Sign-In Failed</Card.Title>
        <AlertCircle className="mb-2 h-6 w-6 text-red-500" />
      </div>
      {getErrorMessage(code)}
    </Card>
  );
}

function getErrorMessage(code: string) {
  switch (code) {
    case "missing_assertion":
      return (
        <Card.Text>
          This request did not arrive through the identity-aware proxy, so Headplane has no
          assertion to verify. Reach Headplane through the load balancer rather than connecting to
          it directly.
        </Card.Text>
      );

    case "audience_mismatch":
      return (
        <Card.Text>
          The assertion was issued for a different service. Set{" "}
          <Code>server.jwt_auth.audience</Code> to this backend service&apos;s audience. The
          Headplane log shows both the expected and the received value.
        </Card.Text>
      );

    case "issuer_mismatch":
      return (
        <Card.Text>
          The assertion came from an unexpected issuer. Check that{" "}
          <Code>server.jwt_auth.provider</Code> matches the proxy actually sitting in front of
          Headplane.
        </Card.Text>
      );

    case "expired_assertion":
      return (
        <Card.Text>
          The assertion has expired. If this keeps happening, check for clock skew between Headplane
          and the proxy.
        </Card.Text>
      );

    case "domain_not_allowed":
      return (
        <Card.Text>
          Your account&apos;s domain is not listed in <Code>server.jwt_auth.allowed_domains</Code>.
        </Card.Text>
      );

    case "missing_email":
    case "missing_subject":
      return (
        <Card.Text>
          The assertion did not identify a user. Confirm the proxy is configured to pass identity
          claims.
        </Card.Text>
      );

    default:
      return (
        <Card.Text>
          The assertion could not be verified. The Headplane log has the details.
        </Card.Text>
      );
  }
}
