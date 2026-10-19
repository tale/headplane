import { type } from "arktype";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { headplaneConfig } from "~/server/config/config-schema";
import { createAppContext, createRouterContext } from "~/server/context";
import type { Role } from "~/server/web/roles";

import { tempDir } from "./temp";

export interface TestAppOptions {
  headscale: { url: string; apiKey: string };
  // Merged over the minimal config, one top-level key at a time.
  config?: Record<string, Record<string, unknown>>;
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

// Any loader or action, whatever its generated argument types.
type RouteFunction = (args: never) => unknown;

export interface CallOptions {
  as?: string;
  params?: Record<string, string>;
  form?: Record<string, string | string[]>;
  search?: string;
  headers?: Record<string, string>;
  // Aborts like a browser closing the connection.
  signal?: AbortSignal;
}

export async function createTestApp(options: TestAppOptions) {
  const { headscale } = options;
  const config = headplaneConfig({
    ...options.config,
    server: {
      cookie_secret: "test-cookie-secret-thirty-two-ch",
      cookie_secure: false,
      data_path: await tempDir(),
      ...options.config?.server,
    },
    headscale: {
      url: headscale.url,
      api_key: headscale.apiKey,
      ...options.config?.headscale,
    },
  });

  if (config instanceof type.errors) {
    throw new Error(`Invalid test config: ${config.summary}`);
  }

  const ctx = await createAppContext(config);
  const api = ctx.headscale.client(headscale.apiKey);
  let users = 0;

  async function signIn(role: Role, profile: { name?: string; email?: string } = {}) {
    // The first user always becomes the owner, so make sure one exists.
    if (role !== "owner" && (await ctx.auth.listUsers()).length === 0) {
      await ctx.auth.findOrCreateUser("test-owner", { name: "Owner" });
    }

    users += 1;
    const subject = `test-${role}-${users}`;
    const name = profile.name ?? `${role} ${users}`;
    const userId = await ctx.auth.findOrCreateUser(subject, { name, email: profile.email });
    if (role !== "owner") {
      await ctx.auth.reassignUser(userId, role);
    } else if ((await ctx.auth.listUsers()).find((user) => user.id === userId)?.role !== "owner") {
      throw new Error("Only the first account becomes the owner, so sign in as it first");
    }

    const setCookie = await ctx.auth.createOidcSession(userId, { name, email: profile.email });
    return { userId, subject, cookie: setCookie.split(";")[0] };
  }

  async function signInWithApiKey(apiKey = headscale.apiKey) {
    const setCookie = await ctx.auth.createApiKeySession(apiKey, "API key", 3_600_000);
    return { cookie: setCookie.split(";")[0] };
  }

  function request(path: string, call: CallOptions = {}) {
    const headers = new Headers(call.headers);
    if (call.as) headers.set("cookie", call.as);

    const url = `http://headplane.test${__PREFIX__}${path}${call.search ?? ""}`;
    if (!call.form) {
      return new Request(url, { headers, signal: call.signal });
    }

    // URL-encoded like the app's forms, which keeps newlines as they are.
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(call.form)) {
      for (const item of [value].flat()) body.append(key, item);
    }

    return new Request(url, { method: "POST", headers, body, signal: call.signal });
  }

  // Runs a loader or action and returns what it returned or threw, since
  // React Router treats a thrown Response the same as a returned one.
  async function call(fn: RouteFunction, path: string, callOptions: CallOptions = {}) {
    const args = {
      request: request(path, callOptions),
      params: callOptions.params ?? {},
      context: createRouterContext(ctx),
      url: new URL(`http://headplane.test${__PREFIX__}${path}${callOptions.search ?? ""}`),
      pattern: path,
      unstable_pattern: path,
    };

    try {
      return await (fn as (args: LoaderFunctionArgs & ActionFunctionArgs) => unknown)(
        args as unknown as LoaderFunctionArgs & ActionFunctionArgs,
      );
    } catch (error) {
      return error;
    }
  }

  return {
    ctx,
    api,
    signIn,
    signInWithApiKey,
    request,
    call,
    async dispose() {
      await ctx.dispose();
    },
    [Symbol.asyncDispose]() {
      return ctx.dispose();
    },
  };
}

export function statusOf(result: unknown): number {
  if (result instanceof Response) return result.status;
  if (result instanceof Error) return 500;
  if (
    result &&
    typeof result === "object" &&
    "type" in result &&
    result.type === "DataWithResponseInit"
  ) {
    return (result as { init?: { status?: number } | null }).init?.status ?? 200;
  }

  return 200;
}
