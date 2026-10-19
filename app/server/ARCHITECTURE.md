# Server architecture

Conventions for code in `app/server/`. The [README](./README.md) covers the
layout, the entry points and how services reach routes.

## Services

A long-lived service is a factory function. It takes its dependencies as
arguments, keeps its state in closure variables and returns a plain object
typed by an interface, such as `createOidcService` in `oidc/provider.ts`,
`createAuthService` in `web/auth.ts` and `createLiveStore` in
`headscale/live-store.ts`.

- Pass dependencies in. A service never imports another service's module to
  reach its state, and there's no module-level state.
- A service with background work exposes `start`/`stop` or `dispose`, as the
  auth service's session pruning does. `createAppContext` registers it with
  the context's disposers.
- Classes are the exception: the `Integration` base in
  `config/integration/abstract.ts` that the Docker, Kubernetes and proc
  integrations extend, error types such as `ActionError` and `ConfigError`,
  and `HeadscaleDNSConfig`.

## Wiring

`createAppContext` in `context.ts` builds every service once at startup.
`app.ts` seeds a named React Router context for each, and routes read them
with `context.get(authContext)` and so on.

A service that can be switched off is a `Feature<T>` (`feature.ts`): either
`enabled` with the service, or `disabled` with a reason the UI can show, as
the agent settings page and the OIDC callback do.

## Errors

- A service operation with expected failures returns `Result<T, E>`
  (`result.ts`) instead of throwing. The error carries a typed `code`, such as
  `OidcErrorCode`, that maps to a log message, the UI and a troubleshooting
  section in the docs.
- Route actions are built with `createAction` and throw `ActionError` for any
  state of the world. See "Action errors" in `AGENTS.md`.
- Invalid configuration at startup throws `ConfigError`.

## Tests

Unit tests (`tests/unit/`) create a fresh service with the config they need,
so no module mocking or resets are involved. Integration tests
(`tests/integration/`) run real dependencies in containers, such as Dex for
OIDC and Tailscale clients for the agent.
