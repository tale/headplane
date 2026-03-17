import { AlertCircle } from "lucide-react";

import Card from "~/components/card";
import Code from "~/components/code";

export function OidcErrorNotice({ code }: { code: string }) {
  return (
    <Card className="m-4 mb-4 max-w-md border border-red-500 sm:m-0 sm:mb-4">
      <div className="flex items-center justify-between gap-4">
        <Card.Title className="text-red-500">Configuration Issue(s)</Card.Title>
        <AlertCircle className="mb-2 h-6 w-6 text-red-500" />
      </div>
      {getErrorMessage(code)}
    </Card>
  );
}

function getErrorMessage(code: string) {
  switch (code) {
    case "error_no_query":
      return (
        <Card.Text>
          The SSO provider did not correctly redirect back to Headplane with the required
          parameters. Please ensure your SSO provider is configured correctly.
        </Card.Text>
      );

    case "error_no_session":
    case "error_invalid_session":
      return (
        <Card.Text>
          Unable to complete SSO login due to missing or invalid session data. Ensure that your
          Headplane cookie configuration is correct and that your browser is accepting cookies.
        </Card.Text>
      );

    case "error_no_sub":
      return (
        <Card.Text>
          The SSO provider did not return a valid user identifier. Please ensure your SSO provider
          is correctly configured to provide the <Code>sub</Code> claim.
        </Card.Text>
      );

    case "error_auth_failed":
      return (
        <Card.Text>
          Authentication with the SSO provider failed. Please try again later. Headplane logs may
          provide more information.
        </Card.Text>
      );

    default:
      return (
        <Card.Text>
          An unknown error occurred during OIDC authentication. Please try again later.
        </Card.Text>
      );
  }
}
