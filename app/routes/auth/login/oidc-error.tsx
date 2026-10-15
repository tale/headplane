import Callout from "~/components/callout";
import Code from "~/components/code";

export function OidcErrorNotice({ code }: { code: string }) {
  return (
    <Callout className="mb-6" title="Single sign-on failed" variant="error">
      {getErrorMessage(code)}
    </Callout>
  );
}

function getErrorMessage(code: string) {
  switch (code) {
    case "error_no_query":
      return (
        <p>
          The SSO provider did not correctly redirect back to Headplane with the required
          parameters. Please ensure your SSO provider is configured correctly.
        </p>
      );

    case "error_no_session":
    case "error_invalid_session":
      return (
        <p>
          Unable to complete SSO login due to missing or invalid session data. Ensure that your
          Headplane cookie configuration is correct and that your browser is accepting cookies.
        </p>
      );

    case "error_no_sub":
      return (
        <p>
          The SSO provider did not return a valid user identifier. Please ensure your SSO provider
          is correctly configured to provide the <Code>sub</Code> claim.
        </p>
      );

    case "error_auth_failed":
      return (
        <p>
          Authentication with the SSO provider failed. Please try again later. Headplane logs may
          provide more information.
        </p>
      );

    default:
      return <p>An unknown error occurred during OIDC authentication. Please try again later.</p>;
  }
}
