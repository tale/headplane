# Headplane
> An advanced UI for [juanfont/headscale](https://github.com/juanfont/headscale)

![Preview](./assets/main-preview.png)

Headscale is a self-hosted version of the Tailscale control server, however, it currently lacks a first-party web UI.
This is a relatively tiny Remix app that aims to provide a usable GUI for the Headscale server.
It's still very early in it's development, however these are some of the features that are planned.

- [ ] Editable tags, machine names, users, etc
- [ ] ACL control through Docker integration
- [x] OIDC based login for the web UI
- [x] Automated API key regeneration
- [x] Editable headscale configuration

## Deployment
> The docker image is not available yet. For now you can build it locally with `docker build -t ghcr.io/tale/headplane:latest .`

In order to use Headplane, you need to be running the Headscale 0.23 alpha or later.
Currently I'd only recommend deploying this with Docker because environment variables are required.
Here's a very basic `docker-compose.yaml` file that utilizes each configuration variable.

```yaml
version: '3.8'
services:
  headscale:
    image: 'headscale/headscale:0.23.0-alpha5'
    container_name: 'headscale'
    restart: 'unless-stopped'
    command: 'serve'
    volumes:
      - './data:/var/lib/headscale'
      - './configs:/etc/headscale'
    ports:
      - '8080:8080'
    environment:
      TZ: 'America/New_York'
  headplane:
    container_name: headplane
    image: ghcr.io/tale/headplane:latest
    restart: unless-stopped
    volumes:
      - './data:/var/lib/headscale'
      - './configs:/etc/headscale'
    ports:
      - '3000:3000'
    environment:
      HEADSCALE_URL: 'http://headscale:8080'
      API_KEY: 'abcdefghijklmnopqrstuvwxyz'
      COOKIE_SECRET: 'abcdefghijklmnopqrstuvwxyz'
      HEADSCALE_CONTAINER: 'headscale'
      OIDC_CLIENT_ID: 'headscale'
      OIDC_ISSUER: 'https://sso.example.com'
      OIDC_CLIENT_SECRET: 'super_secret_client_secret'
      DISABLE_API_KEY_LOGIN: 'true'
      HOST: '0.0.0.0'
      PORT: '3000'
```

#### Required Variables

- **`HEADSCALE_URL`**: The public URL of your Headscale server.
- **`API_KEY`**: An API key used to issue new ones for sessions (keep expiry fairly long).
- **`COOKIE_SECRET`**: A secret used to sign cookies (use a relatively long and random string).

#### Optional Variables

- **`HOST`**: The host to bind the server to (default: `0.0.0.0`).
- **`PORT`**: The port to bind the server to (default: `3000`).
- **`CONFIG_FILE`**: The path to the Headscale `config.yaml` (default: `/etc/headscale/config.yaml`).
- **`HEADSCALE_CONTAINER`**: The name of the Headscale container (for Docker integration).

### SSO/OpenID Connect
If you want to use OpenID Connect for SSO, you'll need to provide these variables.
Headplane will utilize the expiry of your tokens to determine the expiry of the session.

- **`OIDC_ISSUER`**: The issuer URL of your OIDC provider.
- **`OIDC_CLIENT_ID`**: The client ID of your OIDC provider.
- **`OIDC_CLIENT_SECRET`**: The client secret of your OIDC provider.
- **`DISABLE_API_KEY_LOGIN`**: If you want to disable API key login, set this to `true`.

Here's what an example with Authelia would look like if you used the same client for both Headscale and Headplane.
Keep in mind that the recommended deployment would be putting Headplane behind /admin on a reverse proxy.
If you use a different domain than the Headscale server, you'll need to make sure that Headscale responds with CORS headers.

```yaml
- client_id: 'headscale'
  client_name: 'Headscale and Headplane'
  public: false
  authorization_policy: 'two_factor'
  redirect_uris:
      - 'https://headscale.example.com/oidc/callback'
      - 'https://headscale.example.com/admin/oidc/callback'
  scopes:
      - 'openid'
      - 'profile'
      - 'email'
  userinfo_signed_response_alg: 'none'
  client_secret: 'my_super_secret_client_secret'
```

Instructions for deploying this will come soon. It will utilize Docker to support advanced features.
If you do want to fight with the environment variables right now, the image is `ghcr.io/tale/headplane:latest`

## Contributing
If you would like to contribute, please install a relatively modern version of Node.js and PNPM.
Clone this repository, run `pnpm install`, and then run `pnpm dev` to start the development server.

> Copyright (c) 2024 Aarnav Tale
