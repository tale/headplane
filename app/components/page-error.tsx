import { RefreshCw, ServerOff } from "lucide-react";
import { isRouteErrorResponse, useRevalidator } from "react-router";

import { isConnectionError } from "~/server/headscale/api/error-client";
import cn from "~/utils/cn";

import Button from "./button";
import { ErrorBanner } from "./error-banner";

interface PageErrorProps {
  error: unknown;
  page: string;
}

export default function PageError({ error, page }: PageErrorProps) {
  const { revalidate, state } = useRevalidator();

  if (isRouteErrorResponse(error) && isConnectionError(error.data)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ServerOff className={cn("h-12 w-12", "text-mist-400 dark:text-mist-500")} />
        <h2 className="mt-4 text-lg font-semibold">{page} Unavailable</h2>
        <p className="mt-1 max-w-sm text-sm text-mist-500 dark:text-mist-400">
          This page could not be loaded because the Headscale server is unreachable. It will be
          available once the connection is restored.
        </p>
        <Button
          className="mt-6"
          variant="light"
          onPress={() => revalidate()}
          isDisabled={state === "loading"}
        >
          <RefreshCw
            className={cn("mr-2 inline-block h-4 w-4", state === "loading" && "animate-spin")}
          />
          Retry
        </Button>
      </div>
    );
  }

  return <ErrorBanner className="max-w-2xl" error={error} />;
}
