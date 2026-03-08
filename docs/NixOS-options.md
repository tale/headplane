# NixOS module options

All options must be under `services.headplane`.

For example: `settings.headscale.config_path` becomes `services.headplane.settings.headscale.config_path`.

## debug

_Description:_ Enable debug logging

_Type:_ boolean

_Default:_ `false`

## enable

_Description:_ Whether to enable headplane.

_Type:_ boolean

_Default:_ `false`

_Example:_ `true`

## package

_Description:_ The headplane package to use.

_Type:_ package

_Default:_ `pkgs.headplane`

## settings

_Description:_ Headplane configuration options. Generates a YAML config file.
See: https://github.com/tale/headplane/blob/main/config.example.yaml

_Type:_ submodule

_Default:_ `{ }`

## settings.headscale

_Description:_ Headscale specific settings for Headplane integration.

_Type:_ submodule

_Default:_ `{ }`

## settings.headscale.config_path

_Description:_ Path to the Headscale configuration file.
This is optional, but HIGHLY recommended for the best experience.
If this is read only, Headplane will show your configuration settings
in the Web UI, but they cannot be changed.

_Type:_ null or absolute path

_Default:_ `null`

_Example:_ `"/etc/headscale/config.yaml"`

## settings.headscale.config_strict

_Description:_ Headplane internally validates the Headscale configuration
to ensure that it changes the configuration in a safe way.
If you want to disable this validation, set this to false.

_Type:_ boolean

_Default:_ `true`

## settings.headscale.dns_records_path

_Description:_ If you are using `dns.extra_records_path` in your Headscale configuration, you need to set this to the path for Headplane to be able to read the DNS records.
Ensure that the file is both readable and writable by the Headplane process.
When using this, Headplane will no longer need to automatically restart Headscale for DNS record changes.

_Type:_ null or absolute path

_Default:_ `null`

_Example:_ `"/var/lib/headplane/extra_records.json"`

## settings.headscale.public_url

_Description:_ Public URL if differrent. This affects certain parts of the web UI.

_Type:_ null or string

_Default:_ `null`

_Example:_ `"https://headscale.example.com"`

## settings.headscale.tls_cert_path

_Description:_ Path to a file containing the TLS certificate.

_Type:_ null or absolute path

_Default:_ `null`

_Example:_ `"config.sops.secrets.tls_cert.path"`

## settings.headscale.url

_Description:_ The URL to your Headscale instance.
All API requests are routed through this URL.
THIS IS NOT the gRPC endpoint, but the HTTP endpoint.
IMPORTANT: If you are using TLS this MUST be set to `https://`.

_Type:_ string

_Default:_ `"http://127.0.0.1:8080"`

_Example:_ `"https://headscale.example.com"`

## settings.integration

_Description:_ Integration configurations for Headplane to interact with Headscale.

_Type:_ submodule

_Default:_ `{ }`

## settings.integration.agent

_Description:_ Agent configuration for the Headplane agent.

_Type:_ submodule

_Default:_ `{ }`

## settings.integration.agent.cache_path

_Description:_ Where to store the agent cache.

_Type:_ absolute path

_Default:_ `"/var/lib/headplane/agent_cache.json"`

## settings.integration.agent.cache_ttl

_Description:_ How long to cache agent information (in milliseconds).
If you want data to update faster, reduce the TTL, but this will increase the frequency of requests to Headscale.

_Type:_ signed integer

_Default:_ `180000`

## settings.integration.agent.enabled

_Description:_ The Headplane agent allows retrieving information about nodes.
This allows the UI to display version, OS, and connectivity data.
You will see the Headplane agent in your Tailnet as a node when it connects.

_Type:_ boolean

_Default:_ `false`

## settings.integration.agent.host_name

_Description:_ Optionally change the name of the agent in the Tailnet

_Type:_ string

_Default:_ `"headplane-agent"`

## settings.integration.agent.package

_Description:_ The headplane-agent package to use.

_Type:_ package

_Default:_ `pkgs.headplane-agent`

## settings.integration.agent.pre_authkey_path

_Description:_ Path to a file containing the agent preauth key.
To connect to your Tailnet, you need to generate a pre-auth key.
This can be done via the web UI or through the `headscale` CLI.

_Type:_ null or absolute path

_Default:_ `null`

_Example:_ `"config.sops.secrets.agent_pre_authkey.path"`

## settings.integration.agent.work_dir

_Description:_ Do not change this unless you are running a custom deployment.
The work_dir represents where the agent will store its data to be able to automatically reauthenticate with your Tailnet.
It needs to be writable by the user running the Headplane process.

_Type:_ absolute path

_Default:_ `"/var/lib/headplane/agent"`

## settings.integration.proc

_Description:_ Native process integration settings.

_Type:_ submodule

_Default:_ `{ }`

## settings.integration.proc.enabled

_Description:_ Enable "Native" integration that works when Headscale and
Headplane are running outside of a container. There is no additional
configuration, but you need to ensure that the Headplane process
can terminate the Headscale process.

_Type:_ boolean

_Default:_ `true`

## settings.oidc

_Description:_ OIDC Configuration for authentication.

_Type:_ submodule

_Default:_ `{ }`

## settings.oidc.client_id

_Description:_ The client ID for the OIDC client.

_Type:_ string

_Default:_ `""`

_Example:_ `"your-client-id"`

## settings.oidc.client_secret_path

_Description:_ Path to a file containing the OIDC client secret.

_Type:_ null or absolute path

_Default:_ `null`

_Example:_ `"config.sops.secrets.oidc_client_secret.path"`

## settings.oidc.disable_api_key_login

_Description:_ Whether to disable API key login.

_Type:_ boolean

_Default:_ `false`

## settings.oidc.headscale_api_key_path

_Description:_ Path to a file containing the Headscale API key.

_Type:_ null or absolute path

_Default:_ `null`

_Example:_ `"config.sops.secrets.headscale_api_key.path"`

## settings.oidc.issuer

_Description:_ URL to OpenID issuer.

_Type:_ string

_Default:_ `""`

_Example:_ `"https://provider.example.com/issuer-url"`

## settings.oidc.redirect_uri

_Description:_ This should point to your publicly accessible URL
for your Headplane instance with /admin/oidc/callback.

_Type:_ string

_Default:_ `""`

_Example:_ `"https://headscale.example.com/admin/oidc/callback"`

## settings.oidc.token_endpoint_auth_method

_Description:_ The token endpoint authentication method.

_Type:_ one of "client_secret_post", "client_secret_basic", "client_secret_jwt"

_Default:_ `"client_secret_post"`

## settings.server

_Description:_ Server configuration for Headplane web application.

_Type:_ submodule

_Default:_ `{ }`

## settings.server.cookie_secret_path

_Description:_ Path to a file containing the cookie secret.
The secret must be exactly 32 characters long.

_Type:_ null or absolute path

_Default:_ `null`

_Example:_ `"config.sops.secrets.headplane_cookie.path"`

## settings.server.cookie_secure

_Description:_ Should the cookies only work over HTTPS?
Set to false if running via HTTP without a proxy.
Recommended to be true in production.

_Type:_ boolean

_Default:_ `true`

## settings.server.data_path

_Description:_ The path to persist Headplane specific data.
All data going forward is stored in this directory, including the internal database and any cache related files.
Data formats prior to 0.6.1 will automatically be migrated.

_Type:_ absolute path

_Default:_ `"/var/lib/headplane"`

_Example:_ `"/var/lib/headplane"`

## settings.server.host

_Description:_ The host address to bind to.

_Type:_ string

_Default:_ `"127.0.0.1"`

_Example:_ `"0.0.0.0"`

## settings.server.port

_Description:_ The port to listen on.

_Type:_ 16 bit unsigned integer; between 0 and 65535 (both inclusive)

_Default:_ `3000`
