# Basic Integration

The basic integration is not able to offer advanced features such as:
- Automatic management of Access Control Lists (ACLs)
- Management of DNS settings for your tailnet
- Management of the Headscale configuration

In order to support these features please refer to the [Advanced Integration](./docs/Advanced-Integration.md) guide.
Note that in order to use this deployment strategy you need to run Headscale in a Docker container.

## Deployment

Requirements:
- Headscale 0.23 alpha or later
- Headscale and Headplane need a Reverse Proxy (NGINX, Traefik, Caddy, etc)

Headplane is currently best run in a Docker container due to the easy configuration.
Here's a very basic `docker-compose.yaml` file that utilizes each configuration variable.

```yaml
version: '3.8'
services:
  headplane:
    container_name: headplane
    image: ghcr.io/tale/headplane:latest
    restart: unless-stopped
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

> For a breakdown of each configuration variable, please refer to the [Configuration](/docs/Configuration.md) guide. 
> It explains what each variable does, how to configure them, and what the default values are.

You may also choose to run it natively with the distributed binaries on the releases page.
You'll need to manage running this yourself, and I would recommend making a `systemd` unit.

## ACL Configuration
If you would like to get the web ACL configuration working, you'll need to pass the `ACL_FILE` environment variable.
This should point to the path of the ACL file on the Headscale server (ie. `ACL_FILE=/etc/headscale/acl_policy.json`).
