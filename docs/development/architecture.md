---
title: Architecture
description: Service architecture patterns used in Headplane's server code.
outline: [2, 3]
---

# Architecture

Headplane's server code is organized as independent service modules within a
single Node.js process. Each service manages its own state and lifecycle
without relying on a shared god-object or dependency injection framework.

This page documents the patterns that all server-side services must follow.

## Core Pattern: Closure Factories

Every service is a **factory function** that takes its dependencies as
arguments, closes over its private state, and returns a plain object of
functions. No classes, no decorators, no module-level globals.

```ts
// ✅ Correct: closure factory
export function createOidcService(config: OidcConfig): OidcService {
  // Private state — owned by this instance, invisible outside
  let endpoints: ResolvedEndpoints | undefined;
  let cachedAuthMethod: string | undefined;

  function status() {
    if (endpoints) return { state: "ready", endpoints };
    return { state: "pending" };
  }

  async function startFlow() {
    // Uses `config` and `endpoints` from closure
  }

  function invalidate() {
    endpoints = undefined;
    cachedAuthMethod = undefined;
  }

  return { status, startFlow, invalidate };
}
```

```ts
// ❌ Wrong: module-level global state
let endpoints: ResolvedEndpoints | undefined;

export function init(config: OidcConfig) {
  // Mutates module globals — untestable, import-order fragile
}

export function startFlow() {
  // Reads from module globals — can't have two instances
}
```

```ts
// ❌ Wrong: class with `this`
export class OidcService {
  private endpoints?: ResolvedEndpoints;
  // Adds ceremony without adding value over closures
}
```

### Why Closures?

- **Testable**: Create a fresh instance per test with different config. No
  `vi.resetModules()`, no import-order hacks, no singletons to clean up.
- **Composable**: Services can depend on other services by accepting them as
  factory arguments. No container registration, no string keys.
- **Hot-reloadable**: Call `service.reload(newConfig)` or create a new
  instance. Old state is garbage collected.
- **Explicit**: Every dependency is visible in the factory signature. No
  hidden ambient state.

## Service Interface

Every service should define a TypeScript interface for its public API. This
is what consumers (routes, other services, tests) depend on — never the
internal implementation.

```ts
export interface OidcService {
  status(): OidcStatus;
  startFlow(): Promise<Result<FlowData, OidcError>>;
  handleCallback(params: URLSearchParams, state: FlowState): Promise<Result<Identity, OidcError>>;
  invalidate(): void;
  reload(config: OidcConfig): void;
}
```

### Lifecycle Hooks

Services that run background work (timers, polling, watch loops) should
expose lifecycle hooks. These keep the background behavior local to the
service that owns it:

```ts
export interface AuthService {
  require(request: Request): Promise<Principal>;
  can(principal: Principal, cap: Capabilities): boolean;
  // Lifecycle
  start(): void; // Begin session pruning interval
  stop(): void; // Clear interval, clean up
}

export function createAuthService(opts: AuthServiceOptions): AuthService {
  let pruneTimer: NodeJS.Timeout | undefined;

  return {
    require(request) {
      /* ... */
    },
    can(principal, cap) {
      /* ... */
    },
    start() {
      pruneTimer = setInterval(() => void pruneExpiredSessions(), 15 * 60 * 1000);
    },
    stop() {
      if (pruneTimer) clearInterval(pruneTimer);
    },
  };
}
```

## Result Type

Services that can fail use the shared `Result<T, E>` type instead of
throwing exceptions. This makes error handling explicit at every call site.

```ts
import { type Result, ok, err } from "~/server/result";

// Returning success
return ok({ url, flowState });

// Returning failure
return err({ code: "discovery_failed", message: "..." });
```

Routes and other callers use the discriminated union:

```ts
const result = await runtime.oidc.startFlow();
if (!result.ok) {
  // result.error is typed — render the right UI
  return redirect(`/login?s=${result.error.code}`);
}
// result.value is typed
return redirect(result.value.url);
```

`Result` lives in `app/server/result.ts` and is intentionally minimal:

```ts
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
```

## Composition Root

All services are wired together in a single place: `server/index.ts`. This
is the **composition root** — the only file that knows about every service
and how they connect.

```ts
export interface AppRuntime {
  config: HeadplaneConfig;
  db: DbClient;
  auth: AuthService;
  oidc?: OidcService;
  hsApi: HeadscaleInterface;
  agents?: AgentManager;
  stop(): Promise<void>;
}

export async function createAppRuntime(): Promise<AppRuntime> {
  const config = await loadConfig();
  const db = await createDbClient(/* ... */);
  const auth = createAuthService({ db /* ... */ });
  const oidc = config.oidc
    ? createOidcService({
        /* ... */
      })
    : undefined;

  return {
    config,
    db,
    auth,
    oidc,
    async stop() {
      auth.stop?.();
    },
  };
}
```

React Router's `AppLoadContext` wraps the runtime:

```ts
const runtime = await createAppRuntime();

getLoadContext() {
  return { runtime };
}
```

Routes access services through `context.runtime`:

```ts
export async function loader({ context }: Route.LoaderArgs) {
  const principal = await context.runtime.auth.require(request);
  // ...
}
```

### Dependency Direction

Services can depend on other services, but only through explicit factory
arguments — never by importing another service's module and reading its
state:

```ts
// ✅ Correct: explicit dependency
export function createAuthService(opts: {
  db: DbClient;
  // ...
}): AuthService {}

// ❌ Wrong: hidden coupling
import { getDb } from "~/server/db";
export function createAuthService(): AuthService {
  const db = getDb(); // Where does this come from? Is it initialized?
}
```

## Error Handling

### Config-Time vs Flow-Time

Services distinguish between errors that happen during setup (config-time)
and errors that happen during a user action (flow-time). This distinction
determines where and how errors are surfaced:

| Type        | When                     | UI Surface               | Example                                   |
| ----------- | ------------------------ | ------------------------ | ----------------------------------------- |
| Config-time | Before user acts         | Banner on login page     | `discovery_failed`, `invalid_api_key`     |
| Flow-time   | After user starts a flow | Redirect with error code | `token_exchange_failed`, `state_mismatch` |
| Non-fatal   | During a flow            | Logged only              | `userinfo_failed`                         |

### Error Codes

Every service error should have a unique `code` string that maps to:

1. A log message with actionable detail (for the operator)
2. A UI component (for the user)
3. A documentation section (for troubleshooting)

```ts
export interface OidcError {
  code: OidcErrorCode; // Machine-readable, used in URLs and UI switches
  message: string; // Human-readable, for server logs only
  hint?: string; // Troubleshooting suggestion for logs
}
```

## Testing

### Unit Tests

Create a fresh service instance per test with the exact config you need.
No mocking frameworks required:

```ts
import { createOidcService } from "~/server/oidc/provider";

test("status is pending before first discovery", () => {
  const oidc = createOidcService(testConfig);
  expect(oidc.status().state).toBe("pending");
});

test("invalidate clears cached endpoints", async () => {
  const oidc = createOidcService(testConfig);
  await oidc.discover();
  oidc.invalidate();
  expect(oidc.status().state).toBe("pending");
});
```

### Faking Services

For route tests, build a partial runtime with only the services you need:

```ts
function createTestRuntime(overrides: Partial<AppRuntime> = {}): AppRuntime {
  return {
    config: testConfig,
    db: createTestDb(),
    auth: createTestAuth(),
    hsApi: createTestHsApi(),
    stop: async () => {},
    ...overrides,
  };
}

test("login page shows SSO button when OIDC is ready", () => {
  const runtime = createTestRuntime({
    oidc: createOidcService(testOidcConfig),
  });
  // Test the route loader with this runtime
});
```

### Integration Tests

Use real OIDC providers in containers (Dex, Keycloak) via `testcontainers`
to test the full flow without browser automation:

```ts
// Configure Dex with static client + static passwords
// Hit the token endpoint directly
// Validate the entire server-side flow end-to-end
```

## Adding a New Service

1. **Define the interface** in a new file under `app/server/<name>/`.
2. **Write the factory** function that takes explicit deps and returns the
   interface. Keep state in closure variables.
3. **Add lifecycle hooks** (`start`/`stop`/`reload`/`invalidate`) if the
   service has background work or cached state.
4. **Use `Result<T, E>`** for operations that can fail. Define a typed error
   with a `code` field.
5. **Wire it in `createAppRuntime()`** in `server/index.ts`.
6. **Write tests** that create isolated instances — no module mocking needed.
