import { isRouteErrorResponse } from "react-router";

import { isApiError, isConnectionError } from "~/server/headscale/api/error-client";

export interface ErrorInfo {
  kind: "connection" | "forbidden" | "not_found" | "headscale" | "unknown";
  title: string;
  description: string;
  details?: string;
}

const BUG = "This is probably a bug. Report it on GitHub with the details below.";

export function describeError(error: unknown): ErrorInfo {
  if (isRouteErrorResponse(error)) {
    const { data, status, statusText } = error;
    if (isConnectionError(data)) {
      return {
        kind: "connection",
        title: "Can't reach Headscale",
        description: "Check that Headscale is running and that Headplane can connect to it.",
        details: lines(data.requestUrl, data.errorMessage || data.errorCode),
      };
    }

    if (isApiError(data)) {
      const details = lines(
        `${data.statusCode} ${data.requestUrl}`,
        data.data != null ? json(data.data) : data.rawData,
      );

      if (data.statusCode >= 500) {
        return {
          kind: "headscale",
          title: "Headscale returned an error",
          description: `Headscale responded with ${data.statusCode}. Check its logs, then try again.`,
          details,
        };
      }

      if (data.statusCode === 401 || data.statusCode === 403) {
        return {
          kind: "headscale",
          title: "Headscale rejected the request",
          description: "Check that the API key in Headplane's config is valid and hasn't expired.",
          details,
        };
      }

      return {
        kind: "headscale",
        title: "Unexpected response from Headscale",
        description: "Headplane may not support this version of Headscale, or this is a bug.",
        details,
      };
    }

    if (status === 404) {
      return {
        kind: "not_found",
        title: "Page not found",
        description: "There's nothing at this address.",
      };
    }

    const message = messageOf(data);

    if (status === 403) {
      return {
        kind: "forbidden",
        title: "You don't have access",
        description: message ?? "Ask an administrator for access.",
      };
    }

    return {
      kind: "unknown",
      title: "Something went wrong",
      description:
        message ?? `The server responded with ${[status, statusText].filter(Boolean).join(" ")}.`,
    };
  }

  if (error instanceof Error) {
    let root = error;
    while (root.cause instanceof Error) {
      root = root.cause;
    }

    const message =
      root instanceof AggregateError
        ? root.errors.map((e) => (e instanceof Error ? e.message : String(e))).join("\n")
        : root.message;

    return {
      kind: "unknown",
      title: "Something went wrong",
      description: BUG,
      details: `${root.name}: ${message}`,
    };
  }

  return { kind: "unknown", title: "Something went wrong", description: BUG, details: json(error) };
}

function messageOf(data: unknown) {
  if (typeof data === "string" && data.length > 0) {
    return data;
  }

  if (typeof data === "object" && data !== null && "message" in data) {
    return typeof data.message === "string" ? data.message : undefined;
  }
}

function lines(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join("\n\n");
}

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}
