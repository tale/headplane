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
