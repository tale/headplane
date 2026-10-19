# Core Concepts

Headplane is a web application to manage Headscale, a self-hosted implementation
of the Tailscale control server. There are a few tenets that guide the entire
development of the project:

- **Simple starts**: We want to make it as easy as possible to set up and use
  Headplane, while still providing powerful features for advanced users. This
  means that we prioritize a clean and intuitive user interface, as well as
  straightforward installation and configuration processes.

- **No breaking changes**: We want to avoid making breaking changes to the
  project as much as possible. This means that we will strive to maintain
  backward compatibility and provide clear migration paths when necessary.

- **Documentation**: This is the most important part of the project, without it
  the entire project falls apart and is hard to use.

## Project Management

It's hard to manage this project easily, use the `gh` CLI when responding to
prompts to get context. Some common issue tags to keep track of include a
"Needs Triage", "Needs Info", "Bug", "Enhancement", and several other tags based
on what parts of the project are affected.

## Headplane Agent

The Headplane Agent is a lightweight component that runs on the same server as
Headplane and connects directly to the Tailnet in order to pull in details about
nodes that aren't available through the Headscale API such as versions, etc.

## WebSSH

This is an ephemeral WASM shim that runs in the browser and connects directly
to the Tailnet using Tailscale's go packages. It allows anyone to open up an
ephemeral machine in the Tailnet that directly SSHes into a target node.

## Build/Tooling

Headplane is a React Router 7 (framework mode) project built with Vite. Take
care to use our preferred PNPM version and Node version as defined in the
`engines` field of `package.json`. We also use TypeScript Go and Oxfmt for
type-checking and formatting respectively.

When typechecking, use `pnpm run typecheck`, when linting and formatting, use
the respective `lint` and `format` scripts, you can pass flags to them. You can
also run Headscale CLI commands with `docker exec headscale headscale <command>`
when the dev environment is running.

## Action errors

Throw `ActionError` (`app/server/web/actions.ts`) for any state of the world an
action can run into: config, permissions, data, Headscale's version or health.
It shows its message in the form. Use it even when the UI already hides the
action, since what the UI prevents changes over time. Throw a plain `Error`
only for programmer bugs, code paths that should be impossible. Never fall back
to a silent no-op.

## Docs

The project has a documentation site available at the `docs/` directory built
with VitePress. The documentation is written in Markdown and can be easily
edited and extended. If making changes to staple features, please take care to
also update the documentation to reflect any changes in functionality or usage.

## Releases

Every user-facing change adds a line to the `# Next` section of `CHANGELOG.md`,
under `## Changes` or `## Fixes`. That section is what nightly users read on the
docs site, so write it as prose for them, not as a commit summary. Prose placed
directly under `# Next`, above the subheadings, becomes the release preamble.
Use it for compatibility notes and upgrade warnings.

To cut a release, run `pnpm release cut <version>`. It renames `# Next` to the
version, bumps `package.json`, commits, and tags. Pushing the tag builds the
images and publishes the GitHub release from that changelog section.

### Release lines

`main` is the next minor release. Each released minor gets a `release/X.Y`
branch cut from its `.0` tag (or the latest patch tag, when created later), and
patch releases for that minor are cut from there.

- Fixes land on `main` first. Backport with `git cherry-pick -x <sha>` onto
  `release/X.Y`, adapting the code if `main` has diverged, and add the changelog
  line to that branch's own `# Next`. A bug that only exists on the release line
  is fixed directly on its branch.
- Cut patches on the release branch with `pnpm release cut X.Y.Z`, then push
  that branch with `--follow-tags` (not `main`).
- Copy the released `# X.Y.Z` section into `main`'s `CHANGELOG.md` below
  `# Next`, so the beta docs keep the full history.
- Only security and serious regression fixes are backported once the next minor
  ships. New features never are.
