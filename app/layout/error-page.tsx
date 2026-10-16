import { Link as RouterLink } from "react-router";

import Button from "~/components/button";
import { ErrorDetails, ReportLink } from "~/components/page-error";
import Shell from "~/routes/auth/login/shell";
import { describeError } from "~/utils/describe-error";

export default function ErrorPage({ error }: { error: unknown }) {
  const info = describeError(error);
  const canRetry = info.kind !== "forbidden" && info.kind !== "not_found";

  return (
    <Shell description={info.description} title={info.title}>
      <div className="flex flex-wrap items-center gap-3">
        {canRetry && (
          <Button onClick={() => window.location.reload()} variant="primary">
            Try again
          </Button>
        )}
        <Button
          nativeButton={false}
          render={<RouterLink reloadDocument to="/" />}
          variant={canRetry ? "secondary" : "primary"}
        >
          Go to Headplane
        </Button>
        {info.kind === "unknown" && (
          <span className="ml-1 text-sm">
            <ReportLink />
          </span>
        )}
      </div>
      {info.details && <ErrorDetails details={info.details} />}
    </Shell>
  );
}
