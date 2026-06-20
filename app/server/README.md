# `app/server/`

Server-side application code for Headplane. Everything in this directory
runs only on the Node process — never in the browser.

## Layout

```
app/server/
├── app.ts              ← The Headplane application (load context, RR listener)
├── main.ts             ← Production bootstrap (binds an http(s) server)
├── context.ts          ← createAppContext() — assembles the RouterContextProvider data
├── result.ts           ← Result<T, E> helper used across the server modules
│
├── config/             ← YAML config loading, schema, env-overrides, integrations
├── db/                 ← Drizzle SQLite client + schema
├── headscale/          ← Headscale REST API client + headscale-config loader
├── oidc/               ← OIDC provider abstraction
├── web/                ← Authentication service, identity, RBAC capabilities
└── hp-agent.ts         ← Headplane agent process manager
```

## Entry points

There are two SSR entries; both are picked up by Vite via `vite.config.ts`.

### `app.ts` — the application module

Loads config → builds the application context (via [`context.ts`](./context.ts))
→ seeds React Router's `RouterContextProvider` with the named service contexts
→ exports the React Router `RequestListener` as `default`, plus the resolved
`config` as a named export.

This module has no opinions about how the server is hosted. It does not
listen on a socket, doesn't compose static-asset serving, and doesn't
handle the basename redirect — that's the runtime's job (see
[`runtime/`](../../runtime/)).

Consumed by:

- [`main.ts`](./main.ts) in production builds
- [`runtime/vite-plugin.ts`](../../runtime/vite-plugin.ts) in `react-router dev`

### `main.ts` — the production bootstrap

The SSR build input. Rollup bundles this file into
`build/server/index.js`. It:

1. imports the listener + config from [`app.ts`](./app.ts)
2. wraps the listener with `composeListener` from
   [`runtime/http.ts`](../../runtime/http.ts) — adds `/admin → /admin/`
   redirect and serves `build/client/` as static assets with immutable
   caching for the `assets/` subdirectory
3. binds an http(s) server with `startHttpServer`

Run with `node /app/build/server/index.js` (this is what the Dockerfile
does). TLS is a one-line addition: pass `tls: { key, cert }` to
`startHttpServer`.

## Application context

[`context.ts`](./context.ts) exposes `createAppContext(config)`, which
constructs everything that needs to live for the lifetime of the
process:

- the SQLite client (`db`)
- the Headscale REST interface (`headscale`)
- the optional Headplane agent manager (`agents`)
- the auth service (`auth`)
- the optional OIDC service (`oidc`)
- the live store (`hsLive`)
- the (best-effort) parsed Headscale config (`hs`)
- the integration adapter (`integration`)

The returned object owns process-lifetime services, but route handlers consume
those services through named React Router contexts such as `authContext`,
`headscaleContext`, and `headscaleConfigContext`:

When a route needs a service, import the matching context from
`~/server/context`:

```ts
import { authContext } from "~/server/context";

export async function loader({ context, request }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const principal = await auth.require(request);
}
```

## Dev vs. prod

| Concern                                  | Dev (`react-router dev`)                           | Prod (`node build/server/index.js`)                          |
| ---------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| HTTP server                              | Vite owns it (`vite.config.ts` `server.host/port`) | `runtime/http.ts` `startHttpServer`                          |
| Static assets                            | `./public` (served by `runtime/vite-plugin.ts`)    | `build/client/` (served by `runtime/http.ts` static handler) |
| Basename redirect (`/admin` → `/admin/`) | `runtime/vite-plugin.ts` via `composeListener`     | `main.ts` via `composeListener`                              |
| App load (HMR)                           | `ssrLoadModule(app.ts)` per request                | bundled into `build/server/index.js`                         |
| Entry point                              | [`app.ts`](./app.ts)                               | [`main.ts`](./main.ts)                                       |

There is **no** `if (import.meta.env.PROD)` branch in [`app.ts`](./app.ts)
or [`main.ts`](./main.ts) — the dev/prod split is expressed by which
file is loaded, not by runtime conditionals.

## Adding a new server-side module

1. Create the module under an existing subdirectory (or add a new one
   that names a coherent concern, e.g. `metrics/`, `ratelimit/`).
2. If it owns process-lifetime state (a connection pool, a service
   client, …), construct it in [`context.ts`](./context.ts) and add it
   to the returned object. Expose it through a named React Router context
   and seed that context in [`app.ts`](./app.ts)'s `getLoadContext`.
3. If it's purely a helper (pure functions, type definitions), import
   it directly from the module that needs it.
