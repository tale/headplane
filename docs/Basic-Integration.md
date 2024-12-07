# Basic Integration

The basic integration is the simplest way to get started with Headplane.
It's more of a preview and is heavily limited in the features it can offer
when compared to the [Advanced Integration](/docs/Advanced-Integration.md).

> Note that the Advanced integration is the recommend way to run
Headplane in a production environment.

## Limitations
- No automatic management of Access Control Lists (ACLs)
- No management of DNS settings for your tailnet
- No capability to edit the configuration
- Limited support for OIDC authentication

## Deployment

Requirements:
- Headscale 0.23 or newer
- Headscale and Headplane need a Reverse Proxy (NGINX, Traefik, Caddy, etc)

Docker heavily simplifies the deployment process, but this process can be
adopted to run natively. Follow the first section of the deployment guide
in the [Native Integration](/docs/integration/Native.md#deployment) for a
bare-metal or virtual machine deployment.

Here is a simple Docker Compose deployment:
```yaml
services:
  headplane:
    container_name: headplane
    image: ghcr.io/tale/headplane:0.3.9
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      HEADSCALE_URL: 'http://headscale:8080'
      COOKIE_SECRET: 'abcdefghijklmnopqrstuvwxyz'

      # These are all optional!
      ROOT_API_KEY: 'abcdefghijklmnopqrstuvwxyz'
      OIDC_CLIENT_ID: 'headscale'
      OIDC_ISSUER: 'https://sso.example.com'
      OIDC_CLIENT_SECRET: 'super_secret_client_secret'
      DISABLE_API_KEY_LOGIN: 'true'
      COOKIE_SECURE: 'false'

      # These are the default values
      HOST: '0.0.0.0'
      PORT: '3000'
```

Once configured, the Headplane UI will be available at the `/admin` path
of the server you deployed it on. This is currently not configurable unless
you build the Docker image yourself or run the Node.js server directly.

> For a breakdown of each configuration variable, please refer to the
[Configuration](/docs/Configuration.md) guide. 
> It explains what each variable does, how to configure them, and what the
default values are.
