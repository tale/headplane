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

## Sensitive Values
Headplane supports a dual-mode pattern for providing certain sensitive configuration values, such as secrets, keys, and private certificates. For each such field, you can either:

1. Set the value directly in the configuration file (e.g., `cookie_secret: "your-32-character-long-secret"`)
2. Provide a path to a file containing the value using the `_path` suffixed key (e.g., `cookie_secret_path: "/path/to/your/cookie_secret_file"`)

When using a `_path` option, the content of the specified file will be read and used as the value for the setting. These paths can include environment variable interpolation (e.g., `${CREDENTIALS_DIRECTORY}/my_secret_file`), which is useful for integration with tools like systemd's `LoadCredential`.

**Important Rules for Dual-Mode Fields:**
- You **cannot** set both the direct value (e.g., `cookie_secret`) and its corresponding `_path` (e.g., `cookie_secret_path`) simultaneously. Doing so will result in a configuration error.
- If a `_path` is provided, the corresponding direct value field (if also present and not null) will usually be ignored or may cause validation errors depending on the specific field and loader logic. It's best to provide only one.
- The same dual-mode pattern works with environment variables. You can set `HEADPLANE_OIDC__CLIENT_SECRET` for a direct value or `HEADPLANE_OIDC__CLIENT_SECRET_PATH` to specify a path to a file containing the secret.

**Note on Path Processing:**
Headplane uses a whitelist approach to determine which `_path` fields should have their content loaded as secrets. Only the explicitly whitelisted paths below will have their file content read and used as configuration values. All other paths with a `_path` suffix will have environment variables interpolated but will not have their content loaded.

The following configuration options in Headplane are treated as secret paths:

- **Server Settings (`server.*`):**
  - `cookie_secret_path` (for web session encoding)
  - `agent.authkey_path` (for the server's internal agent functionality)
    - *Note:* These are optional. If neither `authkey` nor `authkey_path` are provided for the server's internal agent, or if they resolve to null/empty, Headplane will log a message indicating that its internal agent support features are disabled and will proceed without error.

- **Headscale Connection Settings (`headscale.*`):**
  - `tls_cert_path` (custom TLS certificate for connecting to Headscale)
  - `tls_key_path` (custom TLS private key for connecting to Headscale)
  - `api_key_path` (Headscale API key for Headplane to connect to Headscale)

- **OIDC Settings (`oidc.*`):**
  - `client_secret_path` (OIDC client secret)
  - `headscale_api_key_path` (Headscale API key used by Headplane during the OIDC authentication flow)

**Distinction for Non-Secret Paths:**
Other configuration fields that end with `_path` are treated as regular paths and will not have their content loaded. For example:
- `server.agent.cache_path` (default: `/var/lib/headplane/agent_cache.json`): This is a direct file path where Headplane will *store* its agent cache data.
- `headscale.config_path`: This is an optional path to Headscale's `config.yaml` file, which Headplane might read or use for validation.

All path fields (both secret and non-secret) support environment variable interpolation using the `${VAR_NAME}` syntax.

## Environment Variables
It is also possible to override the configuration file using environment variables.
These changes get merged *after* the configuration file is loaded, so they will take precedence.
Environment variables follow this pattern: **`HEADPLANE_<SECTION>__<KEY_NAME>`**.
For example, to override `oidc.client_secret`, you would set `HEADPLANE_OIDC__CLIENT_SECRET`
to the value that you want.

The path-based secret loading mechanism also works with environment variables. For instance:
- `HEADPLANE_OIDC__CLIENT_SECRET_PATH=/path/to/secret/file` will load the OIDC client secret from the specified file
- `HEADPLANE_SERVER__COOKIE_SECRET_PATH=${CREDENTIALS_DIRECTORY}/cookie_secret` will use environment variable interpolation in the path

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
