# Headplane
> An advanced UI for [juanfont/headscale](https://github.com/juanfont/headscale)

Headscale is a self-hosted version of the Tailscale control server, however, it currently lacks a first-party web UI.
This is a relatively tiny SvelteKit app that aims to provide a usable GUI for the Headscale server.
It's still very early in it's development, however these are some of the features that are planned.

- [ ] Editable tags, machine names, users, etc
- [ ] ACL control through Docker integration
- [ ] OIDC based login for the web UI
- [ ] Automated API key regeneration
- [ ] Editable headscale configuration

## Deployment
Instructions for deploying this will come soon. It will utilize Docker to support advanced features.

## Contributing
If you would like to contribute, please install a relatively modern version of Node.js and NPM.
Clone this repository, run `npm install`, and then run `npm run dev` to start the development server.

> Copyright (c) 2024 Aarnav Tale
