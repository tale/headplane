# Headplane

Headplane is a web UI for Headscale, the self-hosted Tailscale control server.
Three rules guide every change:

- **Simple starts.** Setup should take as little as possible, with advanced
  features opt-in.
- **No breaking changes.** Keep existing configs and setups working. When
  something has to change, give operators an upgrade step (see Releases).
- **Docs ship with the change.** A feature isn't done until its docs are.

## Layout

- `app/`: the React Router 7 app (framework mode, Vite). Server code lives in
  `app/server/`, see its `ARCHITECTURE.md`.
- `cmd/` and `internal/`: Go code. `hp_agent` is the agent, a Tailscale node
  that reads machine details the Headscale API doesn't have. `hp_ssh` is
  Browser SSH, a Tailscale client compiled to WebAssembly that runs in the
  browser. `hp_healthcheck` is the Docker healthcheck.
- `docs/`: the docs site.

## Tooling

Use the Node and pnpm versions from `engines` in `package.json`.

- `pnpm run typecheck`, `pnpm run lint` and `pnpm run format`, which accept
  extra flags.
- `pnpm test:unit` and `pnpm test:integration`.
- `pnpm dev` runs the app against the Docker dev environment. Run Headscale
  commands there with `docker exec headscale headscale <command>`.

Use the `gh` CLI for issues and PRs. Issues are triaged with labels such as
Needs Triage, Needs Info, Bug and Feature, plus area labels like Agent,
Integrations and Web SSH.

## Action errors

Throw `ActionError` (`app/server/web/actions.ts`) for any state of the world an
action can run into: config, permissions, data, Headscale's version or health.
It shows its message in the form. Use it even when the UI already hides the
action, since what the UI prevents changes over time. Throw a plain `Error`
only for programmer bugs, code paths that should be impossible. Never fall back
to a silent no-op.

## Testing

Correctness is the goal. Test count is not. Every test has to earn its place,
and a change that doesn't need a new test shouldn't get one.

Run `pnpm test:unit` (about 2s, no Docker) for every change. Run
`pnpm test:integration` when you touch the Headscale client, the agent, the
platform integrations, or OIDC. It needs Docker.

### What earns a test

Before writing a test, name the regression that would make it fail. If you
can't name a plausible one, or the only way to break it is to rewrite the
implementation the test copies, don't write it.

Worth testing:

- Permission boundaries: which roles can call each loader and action intent.
- Parsing of untrusted input: forms, config, env vars, policies, OIDC claims,
  registration keys.
- Behavior that differs between Headscale versions (`capabilities.ts`).
- Failure and recovery: Headscale down, slow, or returning errors; agent
  crashes; bad config.
- Every fixed bug. Write the failing test first, at the lowest layer that
  reproduces the bug, and name the test for the behavior, not the issue number.

Not worth testing:

- Code that restates a table or constant (role definitions, defaults).
- Anything TypeScript already enforces.
- React Router, valibot, drizzle, or other library behavior.
- Assertions that only check for existence: `toBeDefined()`, "is an array",
  "the client is usable".
- Rendered markup, unless the markup itself is the behavior.

When you work in an area, delete tests there that don't meet this bar. That
counts as part of the change.

### Unit tests (`tests/unit/`)

Most coverage belongs here. A unit test runs in milliseconds, does no network
or container IO, and uses real implementations wherever they're cheap: a
`:memory:` SQLite database, real `createAuthService`, real role checks, real
valibot schemas.

- Don't use `vi.mock` on app modules. If code can't be tested without it, change
  the code: pass the dependency in, return a value instead of calling `exit`,
  read files at the edge. We change app code for testability; we don't contort
  tests around it.
- Route loaders and actions are plain functions. Call them with a real
  `RouterContextProvider` that holds real services. Don't hand-write
  `context.get` switches or cast to `any` or `never`.
- To test Headscale-dependent logic, use the in-memory Headscale fake rather
  than stubbing individual methods. The fake must pass the same contract suite
  as real Headscale (see below). If it can't model a behavior, extend the fake
  and its contract test together.
- Use fake timers for polling, retry, and expiry logic instead of sleeping.
- When a test needs files, write them to a real temp directory. Don't mock
  `node:fs`.

### Integration tests (`tests/integration/`)

Use these for anything that needs real Headscale, a real tailnet, real
containers, or a real identity provider. They're how we know Headplane works
against the versions we claim to support. Prefer a few broad, scenario-shaped
tests over many narrow ones.

- Headscale client contract: one suite runs against every supported version and
  against the in-memory fake.
- Agent lifecycle and faults, Docker, Kubernetes, and `/proc` integrations, and
  OIDC against Dex.
- Each file creates its own environment. Never depend on state left behind by
  another test or file, such as a count of API keys or a node created in an
  earlier test.
- Wait for conditions with `vi.waitFor`. Never sleep for a fixed time.

### Harness (`tests/harness/`)

All container setup goes through one harness, built on `testcontainers`. It
starts disposable tailnets: a Headscale container on its own Docker network,
any number of Tailscale nodes (with or without SSH, tags, routes, or exit
nodes), the agent, Dex, and Headplane in-process, all controlled from test code.
The same harness backs the `pnpm harness` CLI, which keeps a named scenario
running for manual testing, reproducing user setups, and taking docs
screenshots.

- Supported Headscale versions and the pinned Tailscale image live only in
  `tests/harness/versions.ts`. Never hardcode a version in a test.
- Nodes join on the tailnet's network using pre-auth keys. No host networking.
- If you need a container the harness can't create yet, add it to the harness.
  Don't start containers ad hoc in test files.
- Scenarios in `tests/harness/scenarios/` are declarative seed data (users,
  nodes, policy, DNS). Write them to look like real deployments, since they
  appear in screenshots.

The harness is being built. Until it lands, extend the existing setup in
`tests/integration/setup/` and `tests/integration/agent/harness.ts`, and don't
add new one-off setups.

## Docs

The docs site in `docs/` is Fumadocs on React Router (`pnpm docs:dev`).

- Pages are Markdown, or MDX when they use components or expressions. Each
  folder's `meta.json` sets the sidebar order.
- Link between pages by site path, such as `/install/docker`.
- Version numbers (Headscale minimums, Node, pnpm) come from
  `docs/app/lib/versions.ts`. In MDX, write `{versions.headscale.minimum}`.
- Write steps in the imperative and explanations as plain description. Don't
  address the reader as "you".

## Releases

Every user-facing change adds a line to `# Next` in `CHANGELOG.md`, under
`## Changes` or `## Fixes`. Nightly users read it on the docs site, so write it
as prose for them, not as a commit summary. Prose directly under `# Next`,
above the subheadings, becomes the release preamble.

Anything an operator has to act on when upgrading, such as a new minimum
Headscale version, a renamed option or a changed requirement, also gets a line
under `## Upgrading`, above `## Changes`. Write each line as the step to take.
The docs' Upgrading page is built from these sections, so a step that only
appears in the preamble or under Changes is missing from it.

`pnpm release cut <version>` renames `# Next` to the version, bumps
`package.json`, commits and tags. Pushing the tag builds the images and
publishes the GitHub release from that changelog section.

### Release lines

`main` is the next minor release. Each released minor gets a `release/X.Y`
branch cut from its `.0` tag (or its latest patch tag, when created later), and
that minor's patches are cut from there.

- Fixes land on `main` first. Backport with `git cherry-pick -x <sha>` onto
  `release/X.Y`, adapting the code if `main` has diverged, and add the changelog
  line to that branch's own `# Next`. A bug that only exists on the release line
  is fixed directly on its branch.
- Cut patches on the release branch with `pnpm release cut X.Y.Z`, then push
  that branch with `--follow-tags` (not `main`).
- Copy the released `# X.Y.Z` section into `main`'s `CHANGELOG.md` below
  `# Next`, so the beta docs keep the full history.
- Once the next minor ships, only security and serious regression fixes are
  backported. New features never are.

### Docs versions

headplane.net serves the newest release line at the root and every older line
under `/X.Y/`, assembled from docs archives attached to each line's newest
release. `main` deploys the separate beta docs.

- Each stable release builds and attaches its docs, then republishes the site.
- Docs fixes for a released version go to its `release/X.Y` branch. Pushing
  docs changes there rebuilds that line's archives under its newest release and
  republishes, without a new release.
