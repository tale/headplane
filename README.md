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
> For more configuration options, refer to the [Configuration](/docs/Configuration.md) guide.

For fully-featured deployments, see the [Advanced Deployment](/docs/Advanced-Integration.md) guide.
This includes automatic management of ACLs, DNS settings, and Headscale configuration.
*This is the closest experience to the Tailscale UI that can be achieved with Headscale and Headplane.*
*If you aren't sure which one to pick, we recommend this.*

If your environment is not able to support the advanced deployment, you can still use the basic deployment.
For basic deployments, see the [Basic Deployment](/docs/Basic-Integration.md) guide.
It does not include automatic management of ACLs, DNS settings, or the Headscale configuration,
instead requiring manual editing and reloading when making changes.

## Contributing
If you would like to contribute, please install a relatively modern version of Node.js and PNPM.
Clone this repository, run `pnpm install`, and then run `pnpm dev` to start the development server.

> Copyright (c) 2024 Aarnav Tale
