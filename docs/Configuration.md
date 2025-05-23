# Configuration
> Previous versions of Headplane used environment variables without a configuration file.
> Since 0.5, you will need to manually migrate your configuration to the new format.

Headplane uses a configuration file to manage its settings
([**config.example.yaml**](../config.example.yaml)). By default, Headplane looks
for a the file at `/etc/headplane/config.yaml`. This can be changed using the
**`HEADPLANE_CONFIG_PATH`** environment variable to point to a different location.

Headplane also stores stuff in the `/var/lib/headplane` directory by default.
This can be configured on a per-section basis in the configuration file, but
it is very important this directory is persistent and writable by Headplane.

## Environment Variables
It is also possible to override the configuration file using environment variables.
These changes get merged *after* the configuration file is loaded, so they will take precedence.
Environment variables follow this pattern: **`HEADPLANE_<SECTION>__<KEY_NAME>`**.
For example, to override `oidc.client_secret`, you would set `HEADPLANE_OIDC__CLIENT_SECRET`
to the value that you want.

Here are a few more examples:

- `HEADPLANE_HEADSCALE__URL`: `headscale.url`
- `HEADPLANE_SERVER__PORT`: `server.port`

**This functionality is NOT enabled by default!**
To enable it, set the environment variable **`HEADPLANE_LOAD_ENV_OVERRIDES=true`**.
Setting this also tells Headplane to load the relative `.env` file into the environment.
> Also note that this is **only** for configuration overrides, not for general
> environment variables meaning you cannot specify variables such as
> `HEADPLANE_DEBUG_LOG=true` or `HEADPLANE_CONFIG_PATH=/etc/headplane/config.yaml`.

## Debugging
To enable debug logging, set the **`HEADPLANE_DEBUG_LOG=true`** environment variable.
This will enable all debug logs for Headplane, which could fill up log space very quickly.
This is not recommended in production environments.

## Reverse Proxying
Reverse proxying is very common when deploying web applications. Headscale and
Headplane are very similar in this regard. You can use the same configuration
of any reverse proxy you are familiar with. Here is an example of how to do it
using Traefik:

> The important part here is the CORS middleware. This is required for the
> frontend to communicate with the backend. If you are using a different reverse
> proxy, make sure to add the necessary headers to allow the frontend to communicate
> with the backend.

```yaml
http:
  routers:
    headscale:
      rule: 'Host(`headscale.tale.me`)'
      service: 'headscale'
      middlewares:
        - 'cors'

    rewrite:
      rule: 'Host(`headscale.tale.me`) && Path(`/`)'
      service: 'headscale'
      middlewares:
        - 'rewrite'

    headplane:
      rule: 'Host(`headscale.tale.me`) && PathPrefix(`/admin`)'
      service: 'headplane'

  services:
    headscale:
      loadBalancer:
        servers:
          - url: 'http://headscale:8080'

    headplane:
      loadBalancer:
        servers:
          - url: 'http://headplane:3000'

  middlewares:
    rewrite:
      addPrefix:
        prefix: '/admin'
    cors:
      headers:
        accessControlAllowHeaders: '*'
        accessControlAllowMethods:
          - 'GET'
          - 'POST'
          - 'PUT'
        accessControlAllowOriginList:
          - 'https://headscale.tale.me'
        accessControlMaxAge: 100
        addVaryHeader: true
