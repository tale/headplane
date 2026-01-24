import { data, redirect } from "react-router";

import { isDataWithApiError } from "~/server/headscale/api/error-client";
import log from "~/utils/log";

import type { Route } from "./+types/page";

export async function loginAction({ request, context }: Route.LoaderArgs) {
  const formData = await request.formData();
  const apiKey = formData.has("api_key") ? String(formData.get("api_key")) : undefined;

  if (apiKey === undefined) {
    log.warn("auth", "Request made without API key");
    log.warn(
      "auth",
      "If this is unexpected, ensure your reverse proxy (if applicable) is configured correctly",
    );
    throw data("Missing `api_key`", { status: 400 });
  }

  if (apiKey.length === 0) {
    log.warn("auth", "Request made with empty API key");
    log.warn(
      "auth",
      "If this is unexpected, ensure your reverse proxy (if applicable) is configured correctly",
    );
    throw data("Received an empty `api_key`", { status: 400 });
  }

  const api = context.hsApi.getRuntimeClient(apiKey);
  try {
    const apiKeys = await api.getApiKeys();
    console.log(apiKeys);

    // We don't need to check for 0 API keys because this request cannot
    // be authenticated correctly without an API key
    //
    // 0.28.0 pointlessly added asterisks to the prefixes of API keys, which is
    // the dumbest thing I've ever seen.
    const lookup = apiKeys.find((key) => apiKey.startsWith(key.prefix.replaceAll("*", "")));
    if (!lookup) {
      return {
        success: false,
        message: "API key was not found in the Headscale database",
      };
    }

    if (lookup.expiration === null || lookup.expiration === undefined) {
      log.error("auth", "Got an API key without an expiration");
      throw data("API key is malformed", { status: 500 });
    }

    const expiry = new Date(lookup.expiration);
    if (expiry.getTime() < Date.now()) {
      return {
        success: false,
        message: "API key has expired",
      };
    }

    const expiresDays = Math.round((expiry.getTime() - Date.now()) / 1000 / 60 / 60 / 24);

    return redirect("/machines", {
      headers: {
        "Set-Cookie": await context.sessions.createSession(
          {
            api_key: apiKey,
            user: {
              subject: "unknown-non-oauth",
              name: `${lookup.prefix}...`,
              email: `expires@${expiresDays.toString()}-days`,
            },
          },
          expiry.getTime() - Date.now(),
        ),
      },
    });
  } catch (error) {
    // Check if this is a React Router DataWithResponseInit wrapping a Headscale API error
    if (isDataWithApiError(error)) {
      const apiError = error.data;
      // TODO: What in gods name is wrong with the headscale API?
      if (
        apiError.statusCode === 401 ||
        apiError.statusCode === 403 ||
        (apiError.statusCode === 500 && apiError.rawData.trim() === "Unauthorized")
      ) {
        return {
          success: false,
          message: "API key is invalid (it may be incorrect or expired)",
        };
      }
    }

    log.error("auth", "Error while validating API key: %s", error);
    log.debug("auth", "Error details: %o", error);
    return {
      success: false,
      message: "Error while validating API key (see logs for details)",
    };
  }
}
