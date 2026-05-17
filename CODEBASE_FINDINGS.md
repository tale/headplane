# Headplane codebase findings

Date: 2026-05-16

Scope: server-side TypeScript, React Router route modules, client components, live-data/data-fetching paths, auth/session/RBAC, Headscale config/API integration, Go agent/WebSSH code, runtime/build/CI, and docs. This is an architecture and pattern review, not a completed security audit.

## Executive summary

Headplane's biggest codebase risks are not isolated style issues; they cluster around ownership boundaries:

- **Auth/session boundary:** API-key sessions put the raw Headscale API key in the auth cookie, and self-service account linking can claim arbitrary unclaimed Headscale users.
- **Live-data boundary:** the current live path polls globally, caches globally, and tells React Router to re-run whole active route loaders on any resource change.
- **Lifecycle boundary:** process-lifetime services have `setInterval`, child processes, SSE streams, Undici agents, and WASM/tsnet state, but there is no coordinated shutdown/disposal model.
- **Mutation boundary:** config-file edits and several admin/user mutations rely on UI constraints, mutable process state, non-transactional writes, or inconsistent server-side validation.
- **Framework/tooling boundary:** React Router loaders/actions currently carry a lot of app state orchestration. Fate could be a good fit for live `nodes`/`users` data, but it will not fix auth, authorization, config mutation, WebSSH, or agent lifecycle issues by itself.

## Highest-priority findings

### 1. OIDC self-linking can claim arbitrary unclaimed Headscale users

**Severity:** Critical  
**Area:** AuthZ / account linking

**Evidence:**

- `app/routes/home.tsx:84-97` accepts a posted `headscale_user_id` and calls `context.auth.linkHeadscaleUser(principal.user.id, headscaleUserId)`.
- `app/server/web/auth.ts:225-237` grants machine ownership based on `principal.user.headscaleUserId === node.user?.id`.
- `app/routes/machines/machine-actions.ts:57-68` authorizes machine mutations through `canManageNode`.

**Why it matters:** a logged-in OIDC user can forge the form POST and link themselves to any unclaimed Headscale user ID. Once linked, they can manage that user's machines through the machine action authorization path.

**Suggested direction:** recompute allowed self-link targets server-side inside the action and reject anything not in that set. Prefer auto-linking only by verified OIDC subject/email match, and reserve arbitrary linking for admins.

### 2. API-key sessions put the raw Headscale API key in a signed cookie

**Severity:** Critical  
**Area:** Auth/session security

**Evidence:**

- `app/server/web/auth.ts:96-105` manually base64url-encodes JSON and signs it with HMAC.
- `app/server/web/auth.ts:269-283` serializes `{ sid, api_key }` for API-key sessions.
- `app/server/web/auth.ts:144-173` resolves API-key principals from `payload.api_key`; the DB `api_key_hash` is not used to retrieve a server-side secret.
- `app/utils/oidc-state.ts:13-19` explicitly sets `httpOnly`, while the main auth cookie options are not explicit in `app/server/context.ts:49-54` / `app/server/web/auth.ts:96-105`.
- `docs/install/index.md` describes `server.cookie_secret` as encrypting cookies, but the implementation signs rather than encrypts.

**Why it matters:** cookie compromise becomes direct Headscale API compromise, not just Headplane session compromise. HMAC protects integrity, not confidentiality. The auth cookie should be an opaque session handle, not a transport for upstream credentials.

**Suggested direction:** store only `sid` in the cookie; keep the API key encrypted or server-side in the DB/secret store; verify `api_key_hash` if retaining API-key sessions; explicitly set `httpOnly`, `sameSite`, `secure`, `path`, and consider key rotation/versioning. Use timing-safe HMAC comparison if manual signatures remain.

## Live data and data-fetching findings

### 3. SSE events trigger whole-route revalidation instead of resource-scoped updates

**Severity:** High  
**Area:** Client data fetching / live data

**Evidence:**

- `app/utils/live-data.tsx:35-39` calls `revalidator.revalidate()`.
- `app/utils/live-data.tsx:63-82` treats every `changed` event as a global route revalidation.
- `app/routes/util/live.ts:34-37` sends only `{ resource, version }`, not field/object-level deltas or subscribed views.

**Why it matters:** any node/user change can re-run every active loader for the current route tree. Pages such as machines/users load multiple resources and agent metadata, so frequent Headscale changes can become over-fetching and UI churn.

**Suggested direction:** short term, include enough resource metadata to revalidate only affected routes or debounce/coalesce revalidation. Long term, move live data to normalized object/list subscriptions instead of request/route invalidation.

### 4. Live-data pause state is global, boolean, and can stick disabled

**Severity:** High  
**Area:** Client state / live data

**Evidence:**

- `app/root.tsx:41-66` mounts `LiveDataProvider` above all routes.
- `app/routes/auth/login/page.tsx:59-66` calls `pause()` with no dependency array and no cleanup/resume.
- `app/components/dialog.tsx:21-27` uses the same single boolean pause model for dialogs.
- `app/utils/live-data.tsx:136-141` exposes imperative `pause()` / `resume()` with no ownership token.

**Why it matters:** visiting `/login` can leave live updates disabled after navigating into the app. Multiple pause consumers can also fight: closing one dialog can resume live updates while another still expects them paused.

**Suggested direction:** add immediate cleanup in login (`pause(); return resume`) and a dependency array. Replace the boolean with a refcount/token model so each consumer releases only its own pause.

### 5. `hsLive` is process-global but stores one mutable API client

**Severity:** High  
**Area:** Server live data / cache scoping

**Evidence:**

- `app/server/context.ts:86-101` creates one `hsLive` for the entire process.
- `app/server/headscale/live-store.ts:69` keeps `storedApiClient` in shared closure state.
- `app/server/headscale/live-store.ts:113-120` polling uses that shared client.
- `app/server/headscale/live-store.ts:143` and `app/server/headscale/live-store.ts:158` overwrite it from each caller.

**Why it matters:** the last request/action to touch `hsLive` controls which API key future background polls use. A bad/expired user-supplied API-key session can poison live refresh for everyone until another request resets it. Snapshots are also not principal/session scoped.

**Suggested direction:** poll with one stable server credential only, or scope cache/polling by principal/session. If adopting Fate, make this one of the first seams to replace.

### 6. Live store polling is coarse and lifecycle-unmanaged

**Severity:** Medium  
**Area:** Server lifecycle / live data

**Evidence:**

- `app/server/headscale/live-store.ts:38-45` polls nodes every 5s and users every 15s.
- `app/server/headscale/live-store.ts:82-104` compares `JSON.stringify(data)` for the whole resource.
- `app/server/headscale/live-store.ts:113-123` starts intervals lazily but never stops them unless `dispose()` is called.
- `app/server/context.ts:94` creates the store, but no app shutdown path calls `hsLive.dispose()`.

**Why it matters:** whole-resource JSON comparison is order-sensitive and grows with tailnet size. The polling intervals continue for process lifetime and can leak during dev HMR or repeated context creation.

**Suggested direction:** introduce app-level lifecycle management and subscription-aware polling, or replace with event/object-scoped live subscriptions.

### 7. Loader data is mirrored into local state and can overwrite edits during revalidation

**Severity:** Medium  
**Area:** Client state / React patterns

**Evidence:**

- `app/routes/acls/overview.tsx:30-41` mirrors `policy` into `codePolicy` and updates it when loader data changes.
- `app/routes/dns/components/manage-domains.tsx:25-31` mirrors `searchDomains` into local state.

**Why it matters:** global SSE revalidation can replace local edit state. The ACL editor is especially risky because an unsaved policy can be overwritten by background loader refresh.

**Suggested direction:** separate “initial server value” from “dirty draft” state; never overwrite dirty drafts on background revalidation without prompting.

### 8. Fetcher/dialog orchestration is imperative and duplicated

**Severity:** Medium  
**Area:** Client forms / mutations

**Evidence:**

- `app/routes/machines/dialogs/tags.tsx:34-43` uses `submittingRef` + effects to close/unlock.
- `app/routes/settings/auth-keys/dialogs/add-auth-key.tsx:56-71` uses similar orchestration and directly assigns `fetcher.data = undefined`.
- `app/routes/machines/dialogs/routes.tsx:49-63` submits on switch changes without optimistic/error state.

**Why it matters:** each dialog reimplements mutation lifecycle handling. Direct mutation of `fetcher.data` fights router-owned state and can hide stale or failed submissions.

**Suggested direction:** centralize fetcher mutation state handling, or move to an action/mutation primitive with explicit pending/error/success states and optimistic updates.

## Auth, authorization, and route handling findings

### 9. Agent settings route/action lacks capability checks

**Severity:** High  
**Area:** Authorization

**Evidence:**

- `app/routes/settings/agent.tsx:13-27` only authenticates.
- `app/routes/settings/agent.tsx:29-39` only authenticates before triggering sync.

**Why it matters:** any authenticated user can view agent status and trigger sync work if they know the URL, regardless of settings/admin capability.

**Suggested direction:** gate read and sync separately, probably using `read_feature`/`write_feature` or a dedicated agent capability.

### 10. App layout catches all loader errors and destroys sessions

**Severity:** High  
**Area:** Error handling / auth UX

**Evidence:**

- `app/layout/app.tsx:32-103` wraps the whole loader in `try/catch` and redirects to `/login` with `destroySession()` for any error.
- `app/layout/app.tsx:50-67` handles one expected expired-API-key case, but the outer catch covers unrelated failures too.

**Why it matters:** network errors, programming errors, and transient Headscale failures can become silent logouts. It also hides diagnostics from route error boundaries.

**Suggested direction:** catch only expected auth/session errors; let operational/programming errors hit the error boundary or a health banner.

### 11. RBAC is inconsistent across routes/actions

**Severity:** Medium/High  
**Area:** Authorization

**Evidence:**

- `app/routes/machines/machine-actions.ts:64-68` performs resource-specific checks via `canManageNode`.
- `app/routes/users/user-actions.ts:10-17` checks only broad `write_users` before operations.
- `app/routes/home.tsx:84-97` lets OIDC users link Headscale identities without revalidating target ownership.
- `app/routes/settings/auth-keys/actions.ts:23-35` has more careful self-service ownership checks, showing the pattern exists but is not universal.

**Why it matters:** permissions are enforced route-by-route with no single policy layer, so new actions can accidentally rely on UI hiding. The self-linking issue is one concrete outcome.

**Suggested direction:** create server-side action guards for common ownership/role decisions and require every mutation to call one.

### 12. Runtime role input is not validated and ownership updates are non-transactional

**Severity:** Medium  
**Area:** Auth/RBAC data integrity

**Evidence:**

- `app/routes/users/user-actions.ts:82-104` casts `newRole as Role` from form data.
- `app/server/web/auth.ts:467-484` upserts that role into the DB.
- `app/server/web/auth.ts:430-464` transfers ownership with two separate updates.
- `app/server/web/auth.ts:324-342` makes the first user owner with a count-after-insert flow.

**Why it matters:** forged role values can reach storage, and failures/races in ownership transfer or first-login owner selection can produce invalid owner state.

**Suggested direction:** validate `newRole` against `Roles` at the route boundary, use transactions for ownership transfer, and make first-owner assignment atomic.

### 13. Login page has live-data and URL cleanup bugs

**Severity:** Medium  
**Area:** Client route behavior

**Evidence:**

- `app/routes/auth/login/page.tsx:59-66` pauses live data on every render and never resumes.
- `app/routes/auth/login/page.tsx:68-84` uses `window.history.replaceState` manually.
- `app/routes/auth/login/page.tsx:78-80` builds `newUrl` with `` `{${window.location.pathname}?...` ``, leaving a literal `{` in the URL.

**Why it matters:** this can disable live updates and corrupt/uglify login URLs. Manual history mutation bypasses router state.

**Suggested direction:** use a loader redirect or router navigation where possible; otherwise fix the string and make the effect one-shot with cleanup.

## Headscale API and config mutation findings

### 14. Headscale API errors are collapsed into `502 Bad Gateway`

**Severity:** Medium/High  
**Area:** API wrapper / error handling

**Evidence:**

- `app/server/headscale/api/index.ts:139-145` converts network errors to React Router `data(..., 502)`.
- `app/server/headscale/api/index.ts:183-203` converts every Headscale `>=400` response to outer status 502 while preserving the real status only inside the body.
- Many callers inspect raw strings/statuses manually, e.g. `app/routes/auth/login/action.ts:78-93` and `app/routes/acls/acl-action.ts:39-107`.

**Why it matters:** UI and route logic must understand wrapper internals. HTTP semantics are obscured, and handling becomes string-fragile.

**Suggested direction:** preserve upstream status classes where safe, expose typed domain errors, and make expected Headscale quirks explicit in one adapter layer.

### 15. OpenAPI polling interval has no disposal and returned interface exposes stale values

**Severity:** Medium  
**Area:** Server lifecycle / API versioning

**Evidence:**

- `app/server/headscale/api/index.ts:241-250` starts a `setInterval` inside `createHeadscaleInterface`.
- `app/server/headscale/api/index.ts:252-272` returns `openapiHashes` and `apiVersion` as values captured at return time, while `clientHelpers.isAtleast` reads the mutable closure.
- No `dispose()` exists on the interface.

**Why it matters:** lifecycle leaks in dev/reload scenarios, and consumers reading `context.hsApi.apiVersion` can see stale data while helpers see updated data.

**Suggested direction:** add lifecycle, expose getters for mutable version state, or only detect once at startup.

### 16. Config patching is not safely serialized

**Severity:** Medium/High  
**Area:** Config mutation / concurrency

**Evidence:**

- `app/server/headscale/config-loader.ts:63-127` mutates the YAML document before acquiring `writeLock`.
- `app/server/headscale/config-loader.ts:120-127` sets `writeLock = true` without `try/finally`; a failed write can leave the lock stuck.
- `app/server/headscale/config-dns.ts` has a similar write-lock pattern (see `writeLock` usage).

**Why it matters:** concurrent admin actions can interleave mutations, lose updates, or deadlock future writes after an exception.

**Suggested direction:** replace the boolean lock/spin loop with a promise queue or mutex; acquire before document mutation; release in `finally`; write atomically via temp file + rename.

### 17. DNS/config actions mutate shared config arrays and lack input validation

**Severity:** Medium  
**Area:** Config mutation / validation

**Evidence:**

- `app/routes/dns/dns-actions.ts:103-118` pushes nameservers into arrays read from `context.hs.c`.
- `app/routes/dns/dns-actions.ts:147-164` pushes search domains into arrays read from `context.hs.c`.
- `app/routes/dns/dns-actions.ts:189-209` writes DNS record type/value from form data with minimal validation.

**Why it matters:** in-memory config can be mutated before persistence succeeds, and invalid values can be written directly to Headscale config.

**Suggested direction:** clone before modification, validate domain/IP/record types server-side, and return actionable typed errors.

### 18. Restrictions config actions fire integration restarts without awaiting them

**Severity:** Medium  
**Area:** Config mutation / operational consistency

**Evidence:**

- `app/routes/settings/restrictions/actions.ts:51`, `:79`, `:100`, `:129`, `:150`, `:179` call `context.integration?.onConfigChange(api)` without `await`.
- `app/routes/dns/dns-actions.ts` generally awaits the same hook.

**Why it matters:** the response can report success while restart/reload fails in the background, and unhandled rejections can be lost.

**Suggested direction:** await the hook consistently or queue/retry restarts through an explicit background job with surfaced status.

## Server lifecycle and runtime findings

### 19. Process-lifetime services have no composition-root `stop()`

**Severity:** High  
**Area:** Server lifecycle

**Evidence:**

- `app/server/context.ts:21-101` constructs DB, Headscale API, live store, auth service, OIDC, optional agent manager, and integration.
- `app/server/app.ts:38-40` starts auth pruning.
- `app/server/hp-agent.ts:319-359` starts an interval and child process with `dispose()`.
- `app/server/headscale/live-store.ts:182-191` has `dispose()`.
- `runtime/http.ts:192-200` handles SIGINT/SIGTERM by closing the HTTP server and exiting, but has no app context cleanup.
- `runtime/vite-plugin.ts:44-50` uses `ssrLoadModule` in dev; HMR can recreate modules/services without calling old disposers.

**Why it matters:** intervals, child processes, SSE listeners, and Undici agents can leak in dev and are force-killed in production instead of being drained.

**Suggested direction:** return an app runtime with `stop()` from the composition root; call `auth.stop()`, `hsLive.dispose()`, `agents.dispose()`, `hsApi.undiciAgent.close()`, and integration cleanup from production shutdown and Vite HMR dispose hooks.

### 20. Architecture docs describe patterns the code no longer fully follows

**Severity:** Medium  
**Area:** Documentation / maintainability

**Evidence:**

- `docs/development/architecture.md:15-20` says all services are closure factories, no classes/globals.
- `app/server/headscale/config-loader.ts:21-213` uses a mutable class for Headscale config.
- `docs/development/architecture.md:162-218` describes `server/index.ts`, `AppRuntime`, and `context.runtime`, while current code uses `app/server/app.ts`, `createAppContext`, and direct `context.<service>`.

**Why it matters:** docs are important to this project. Stale architecture guidance makes future changes less consistent and harder for agents/contributors to follow.

**Suggested direction:** update the architecture docs to the current composition root and explicitly document exceptions such as config-file wrappers.

## Go agent and WebSSH findings

### 21. WebSSH WASM lacks a top-level disposal model and leaks JS functions

**Severity:** High  
**Area:** WebSSH lifecycle / browser resources

**Evidence:**

- `app/routes/ssh/page.tsx:156-188` creates the WASM/IPN instance and cleanup only sets `cancelled = true`.
- `app/routes/ssh/wasm.client.ts:27-29` exposes `openTunnel` only; no `dispose()`.
- `cmd/hp_ssh/hp_ssh.go:16-80` creates JS functions but never releases them with `js.Func.Release()`.
- `internal/hp_ipn/ipnserver.go:107-133` starts backend/server work but exposes no shutdown API.

**Why it matters:** repeated SSH sessions can leave in-browser tsnet/backend resources and JS function handles alive until tab refresh.

**Suggested direction:** add top-level `dispose()` to the JS API, release Go `js.Func` handles, cancel contexts, close sessions/backend/server, and call dispose from React cleanup.

### 22. WebSSH disables SSH host key verification

**Severity:** Medium/High  
**Area:** Security / WebSSH

**Evidence:**

- `internal/hp_ipn/ssh.go:59-63` returns `nil` from `HostKeyCallback`.

**Why it matters:** this accepts any host key and allows MITM within the network path. Tailscale identity reduces exposure, but SSH host identity is still bypassed.

**Suggested direction:** document the tradeoff clearly at minimum. Prefer known_hosts-style pinning, Tailscale SSH identity integration, or an explicit trust-on-first-use flow.

### 23. Go agent can panic on peers without Tailscale IPs

**Severity:** Medium  
**Area:** Go agent robustness

**Evidence:**

- `internal/tsnet/peers.go:61` indexes `peer.TailscaleIPs[0]`.
- `internal/tsnet/peers.go:119` also indexes `peer.TailscaleIPs[0]` before checking `len(ip) == 0`.

**Why it matters:** transient or malformed peer state can crash host-info collection.

**Suggested direction:** check `len(peer.TailscaleIPs) > 0` before indexing in both paths.

### 24. Go agent preflight uses `http.Get` without timeout and does not close response bodies

**Severity:** Medium  
**Area:** Go agent robustness

**Evidence:**

- `internal/config/preflight.go:40-56` calls `http.Get(testURL)` directly.
- `internal/config/preflight.go:47-54` never closes `resp.Body`.

**Why it matters:** startup can hang indefinitely on network issues, and response bodies leak.

**Suggested direction:** use `http.Client{Timeout: ...}` and `defer resp.Body.Close()`.

### 25. Go library-like code exits the process and logging is hand-rolled

**Severity:** Medium  
**Area:** Go maintainability

**Evidence:**

- `internal/tsnet/server.go:22-72` uses `log.Fatal` inside `NewAgent`/`Connect` rather than returning errors.
- `internal/util/logger.go:25-29` defines `encoder` and `pool`, but `internal/util/logger.go:59-66` only writes plain stderr lines and exits on fatal.

**Why it matters:** callers cannot recover or return structured errors, and the logger has unused complexity while still lacking structured output.

**Suggested direction:** return errors from `NewAgent`/`Connect`, let `cmd/hp_agent` decide process exit, and simplify or replace the logger.

## Build, CI, and tooling findings

### 26. CI does not explicitly run typecheck or lint

**Severity:** Medium  
**Area:** Tooling / quality gates

**Evidence:**

- `package.json` has `typecheck`, `lint`, and `format` scripts.
- `.github/workflows/build.yaml:32-37` runs `./build.sh --skip-pnpm-prune`, unit tests, and integration tests.
- `build.sh:157-173` runs `pnpm run build`, not `pnpm run typecheck` or `pnpm run lint`.

**Why it matters:** Vite/React Router builds transpile TypeScript but are not a substitute for `tsgo` typechecking. Lint-only issues can land despite local scripts existing.

**Suggested direction:** add `pnpm run typecheck` and `pnpm run lint` to CI. Consider `pnpm run format --check` if supported by oxfmt.

### 27. Build script leaves temporary `vendor/` behind if WASM build fails

**Severity:** Low/Medium  
**Area:** Build hygiene

**Evidence:**

- `build.sh:143-154` runs `go mod vendor`, applies a patch, builds, then removes `vendor` only after success.

**Why it matters:** failed local builds can leave a large generated directory in the worktree, which is easy to accidentally inspect or commit around.

**Suggested direction:** add a trap around the vendoring step to remove `vendor` on failure.

## Fate/SPA/Vite+ migration assessment

### Updated direction: SPA first, not Void first

After comparing the shape of Headplane with Void's current platform/runtime direction, the better target is **not** a Void app. Headplane is a self-hosted local control-plane UI that needs a predictable Node process, local filesystem/config access, SQLite, child process/agent management, long-lived SSE, and a packaging story that can eventually compile into a Node static SEA.

The preferred target is now a one-way SPA cutover:

```text
Hono Node server + Vite SPA + TanStack Router + raw Fate
```

The important architectural choice is that **Fate becomes the data framework directly** while the app shell stays thin. The shell should own static assets, cookies/session plumbing, routing, and lifecycle. Fate should own reads, mutations/actions, normalized cache updates, and live object/list subscriptions. Do not build a Headplane-specific abstraction layer over Fate's live bus, view resolution, actions, or native HTTP handlers unless a concrete repeated problem appears after using the raw APIs.

Void may still be a useful reference implementation for Fate integration, but it should not drive Headplane's runtime architecture unless it later proves a first-class self-hosted Node mode that fits Headplane's install model.

### Current Fate fit

Fate is directly aimed at the pain Headplane is showing: declarative views, normalized cache, data masking, Async React, optimistic actions/mutations, and live views over SSE. Fate 1.0 says it now includes production-ready live views, Drizzle support, garbage collection, and native HTTP transport. The docs also still contain an alpha warning in the getting-started page, so I would treat the ecosystem as promising but still worth piloting behind a branch.

Headplane is already close on prerequisites:

- React is `19.2.5` and Fate requires React 19.2+.
- The app already uses Vite 8-era tooling, Vitest, Oxlint, Oxfmt, tsgo, and pnpm.
- Headplane already has Drizzle, but only for Headplane-local data (`users`, sessions, host info), while core tailnet data comes from the remote Headscale API.

### What Fate would improve

- Replace `LiveDataProvider` + `useRevalidator()` with object/list-level subscriptions (`useLiveView` / `useLiveListView`).
- Normalize `nodes`, `users`, pre-auth keys, and agent host info instead of passing large loader payloads around.
- Let components declare data needs near rendering rather than building large page-level loader DTOs.
- Make mutations return selected updated data and update dependent views without manual `context.hsLive.refresh(...)` calls.

### What Fate will not fix

- API-key-in-cookie session design.
- Self-linking authorization.
- Missing route/action capability checks.
- Headscale config-file write races.
- WebSSH/WASM lifecycle and SSH host-key verification.
- Go agent robustness issues.

These should be fixed before or alongside any framework migration.

### Headplane-specific adoption challenges

- **Remote API source:** Fate's Drizzle adapter helps for local DB rows, but `Machine`, `User`, `PreAuthKey`, ACL policy, and DNS/config data mostly come from Headscale REST/config files. A Headscale Fate source/adapter or custom native HTTP query layer would be needed.
- **Authorization:** Fate views must be scoped by the authenticated principal. Do not reproduce the current process-global cache or mutable API client.
- **Live events:** Headscale does not appear to push the exact object-level events Headplane needs, so Headplane may still need polling or mutation-triggered `live.update(...)` calls. The win is to send object/list updates to subscribed views, not to revalidate whole routes.
- **Server framework:** the desired end state is no longer another heavyweight metaframework. Hono is a good fit for the server shell because it uses the Fetch `Request`/`Response` model Fate already targets, while still running as a normal self-hosted Node process.

### Target runtime shape

```text
╭────────────────────────────────────────────╮
│ Node static SEA / Docker image              │
│ - bundled server JS                         │
│ - embedded or adjacent Vite client assets   │
╰───────────────────┬────────────────────────╯
                    │
                    ▼
╭────────────────────────────────────────────╮
│ Hono Node server                             │
│ - process lifecycle start/stop               │
│ - static asset + SPA fallback serving        │
│ - cookie/session middleware                  │
│ - /fate and /fate/live                       │
│ - /api, /events during transition            │
╰───────────────────┬────────────────────────╯
                    │
                    ▼
╭────────────────────────────────────────────╮
│ Framework-neutral Headplane server core      │
│ - auth/session/authorization                 │
│ - Headscale API/config adapters              │
│ - agent manager                              │
│ - Fate live bus used directly                │
╰───────────────────┬────────────────────────╯
                    │
                    ▼
╭────────────────────────────────────────────╮
│ Vite SPA                                    │
│ - TanStack Router for navigation/search      │
│ - raw Fate for all app data and mutations    │
│ - no route loaders/actions/fetchers          │
╰────────────────────────────────────────────╯
```

### Node SEA packaging implications

The SPA direction is a better fit for a Node static SEA than SSR framework mode because the runtime can become one server entry plus a finite static asset set. The server should be structured so that production can first serve assets from `build/client`, then later swap that out for an embedded asset manifest without changing application routing.

Practical constraints for the SEA target:

- keep one explicit production server entry instead of framework-generated adapter code;
- avoid dynamic runtime imports for route modules in production;
- make client assets addressable by a generated manifest rather than filesystem discovery;
- keep mutable data outside the SEA (`data_path`, Headscale config paths, SQLite, logs);
- preserve direct file serving for large WASM artifacts until we decide whether they should be embedded or adjacent assets.

### Raw Fate rule

Use Fate's public APIs directly:

- `createFateServer(...)` and the native HTTP handler for `/fate`;
- Fate's live bus directly for `live.update(...)`, `live.delete(...)`, and connection/list invalidations;
- Fate's context callback directly for request auth and Headscale API access;
- `FateClient`, `createClient` / `createHTTPTransport` while bootstrapping, then generated `createFateClient(...)` once the Fate Vite plugin has a real server module;
- `useRequest`, `useView`, `useLiveView`, `useLiveListView`, and Fate actions directly in React.

Do not add project-level wrappers such as `HeadplaneLivePublisher`, `HeadplaneDataContext`, or a custom Fate transport abstraction at the beginning. If raw Fate usage becomes repetitive, extract only the smallest local helper at the repetition site.

### Current scaffold on `tale/fate-spa`

- Removed the earlier `HeadplaneRuntime`, `HeadplaneDataContext`, and `HeadplaneLivePublisher` scaffolding.
- Added direct dependencies: `react-fate`, `@nkzw/fate`, `@tanstack/react-router`, `@tanstack/router-plugin`, and `@vitejs/plugin-react`.
- Added a plain Vite SPA `index.html` and `app/spa` entry with TanStack Router and the generated raw Fate client from `react-fate/client`.
- Moved the old React Router Vite config to `vite-old.config.ts` and replaced `vite.config.ts` with a clean SPA config.
- Added Hono and `@hono/node-server`, plus a minimal Hono server shell in `app/server/hono-app.ts`, `app/server/hono-dev.ts`, and `app/server/hono-main.ts`.
- Added `app/server/fate.ts`, which exports a raw Fate server and live bus. Hono mounts Fate's `createHonoFateHandler(fate)` at `/admin/fate` and `/admin/fate/*`, passing the existing app context through Hono variables.
- Wired the official `react-fate/vite` plugin to `app/server/fate.ts`, ignored generated `.fate/` output, and made `pnpm run typecheck` run `fate generate` before `tsgo` so generated `react-fate/client` typings exist from a clean checkout.
- Added the first real Fate read roots: `machines` and `users`. They use Fate `dataView(...)`, `list(...)`, and source executors directly, call the existing principal-scoped Headscale runtime API client, and enforce existing `read_machines` / `read_users` capabilities.
- Added minimal SPA `/machines` and `/users` routes that fetch with raw `useRequest(...)`, render records with `useLiveView(...)`, and subscribe to root list connections with `useLiveListView(...)`. These routes intentionally do not port filters, actions, or optimistic updates yet.
- Bridged existing `hsLive` resource changes directly to Fate connection invalidations: `nodes` invalidates the `machines` root connection and `users` invalidates the `users` root connection. This is a temporary seam so converted routes can exercise Fate live primitives before the old live store is deleted.
- Added the first raw Fate mutation, `machine.rename`. It reuses existing `canManageNode` authorization, calls the Headscale API, refreshes the transitional `hsLive` nodes resource, emits direct Fate entity/list live events, and returns the client-selected `Machine` view.
- `pnpm dev` now runs the Hono/Vite middleware shell with local `.data` storage for the example config; `pnpm build` now runs `vite build` for the SPA.
- Fate's Drizzle peer currently warns against the repo's Drizzle `1.0.0-beta.21`; avoid Fate's Drizzle adapter until that compatibility is resolved, and start with a direct Headscale source/resolver instead.

### Fate context decision

The current Fate request context should stay pragmatic rather than heavily decomposed:

- expose `api`, the principal-scoped Headscale runtime client, as the primary data access path for remote Headscale data;
- keep `principal` and `request` available for authorization and future audit/session needs;
- keep `app` available during the migration so resolvers can reuse the existing auth/config/agent services without inventing a new service layer first;
- do not pass an unstructured context into every helper by default once a data domain settles. If a `machines`, `users`, or `authKeys` module becomes large, give that module explicit functions that accept the concrete pieces it uses.

In other words: full app context is acceptable as migration scaffolding, but the resolver code should prefer the smallest direct dependency (`ctx.api`, `ctx.app.auth`, etc.) and should not become a new `HeadplaneRuntime` abstraction.

### Recommended migration sequence

1. **Remove transitional abstractions** and make the branch clearly one-way toward SPA + raw Fate.
2. **Install the direct dependencies**: `react-fate`, `@nkzw/fate`, `@tanstack/react-router`, `@tanstack/router-plugin`, and the plain Vite React plugin if the React Router plugin is removed.
3. **Replace the build/dev entry shape**:
   - add a Vite SPA entry and TanStack route tree;
   - stop generating new React Router route types;
   - keep the existing Node server entry as the self-hosted process.
4. **Mount raw Fate endpoints** in the current Node request path:
   - `/fate` for native RPC;
   - `/fate/live` for SSE and subscription control;
   - request context resolves auth using the existing auth service and calls `context.hsApi.getRuntimeClient(...)` directly.
5. **Convert the machines page first** using raw Fate views and live list/view hooks.
6. **Add live updates to the converted lists** by publishing Fate list/entity invalidations from the existing polling/mutation seams. Keep this raw Fate live bus usage, not a Headplane live wrapper.
7. **Port one mutation at a time**, starting with a low-risk machine mutation such as rename. The mutation should call the existing Headscale API, return the selected entity, and emit the relevant Fate live event.
8. **Delete the old React Router loader/action/SSE path for converted data**, rather than running duplicate data models side-by-side.
9. **Fix critical auth/session issues early**: self-linking, raw API-key cookie, agent-route authz.
10. **Keep runtime changes minimal** until the SPA actually needs them: Hono routes, static SPA fallback, Fate routes, and later SEA asset serving.

### Vite+ / VoidZero tooling assessment

Vite+ is a unified CLI (`vp`) for Vite, Vitest, Oxlint, Oxfmt, Rolldown, tsdown, type checking, package-manager/runtime management, and task caching. Headplane already uses most of these tools separately, so Vite+ would mostly consolidate tooling and improve task ergonomics; it will not solve the data-layer problems by itself.

Recommended Vite+ approach:

- Try `vp migrate` in a separate branch only after adding CI typecheck/lint gates.
- Expect manual work around the custom React Router SSR entry and `runtime/vite-plugin.ts`.
- Do not combine Vite+ migration with Fate/Void/router migration in the same PR.

## Suggested immediate backlog

1. Replace the temporary `hsLive` bridge with direct Fate events from converted mutations and, if needed, a principal-safe polling source.
2. Move the machine rename UI out of the throwaway table row controls once the permanent SPA machines page layout exists.
3. Port the next machine mutations: expire/delete/tags/routes, one at a time, each returning selected data or deleting/updating the normalized cache explicitly.
4. Fix OIDC self-linking authorization.
5. Make API-key sessions opaque/server-side and set explicit auth cookie flags.
6. Add capability checks to `/settings/agent` loader/action.
7. Fix live-data pause cleanup/refcounting for unconverted React Router routes.
8. Make `hsLive` use a stable server credential or principal-scoped cache while it still exists.
9. Serialize config patches with a real mutex/queue and clone config arrays before editing.
10. Add CI `pnpm run typecheck` and `pnpm run lint`.
11. Add WebSSH top-level dispose and release Go `js.Func` values.
