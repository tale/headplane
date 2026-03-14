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

## Docs

The project has a documentation site available at the `docs/` directory built
with VitePress. The documentation is written in Markdown and can be easily
edited and extended. If making changes to staple features, please take care to
also update the documentation to reflect any changes in functionality or usage.
