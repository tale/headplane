# Headplane
> An advanced UI for [juanfont/headscale](https://github.com/juanfont/headscale)

![Preview](/assets/main-preview.png)

Headscale is a self-hosted version of the Tailscale control server, however, it currently lacks a first-party web UI.
Headplane aims to solve this issue by providing a GUI that can deeply integrate with the Headscale server.
It's able to replicate nearly all of the functions of the official Tailscale SaaS UI, including:

- Machine/Node expiry, network routing, name, and owner management
- Access Control List (ACL) and tagging configuration
- Support for OpenID Connect (OIDC) as a login provider
- DNS and *safe* Headscale configuration management

## Deployment
- If you run Headscale in a Docker container, see the [Advanced Deployment](/docs/Advanced-Integration.md) guide.
- If you run Headscale natively, see the [Basic Deployment](/docs/Basic-Integration.md) guide.
- For more configuration options, refer to the [Configuration](/docs/Configuration.md) guide.

## Contributing
If you would like to contribute, please install a relatively modern version of Node.js and PNPM.
Clone this repository, run `pnpm install`, and then run `pnpm dev` to start the development server.

> Copyright (c) 2024 Aarnav Tale
