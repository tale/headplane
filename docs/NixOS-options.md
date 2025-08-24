# NixOS module options

All options must be under `services.headplane`.

For example: `settings.headscale.config_path` becomes `services.headplane.settings.headscale.config_path`.

## debug
*Description:* Enable debug logging

*Type:* boolean

*Default:* `false`


## enable
*Description:* Whether to enable headplane.

*Type:* boolean

*Default:* `false`

*Example:* `true`


## package
*Description:* The headplane package to use.

*Type:* package

*Default:* `pkgs.headplane`


## settings
*Description:* Headplane configuration options. Generates a YAML config file.
See: https://github.com/tale/headplane/blob/main/config.example.yaml


*Type:* submodule

*Default:* `{ }`


## settings.headscale
*Description:* Headscale specific settings for Headplane integration.

*Type:* submodule

*Default:* `{ }`


## settings.headscale.config_path
*Description:* Path to the Headscale configuration file.
This is optional, but HIGHLY recommended for the best experience.
If this is read only, Headplane will show your configuration settings
in the Web UI, but they cannot be changed.


*Type:* null or absolute path

*Default:* `null`

*Example:* `"/etc/headscale/config.yaml"`


## settings.headscale.config_strict
*Description:* Headplane internally validates the Headscale configuration
to ensure that it changes the configuration in a safe way.
If you want to disable this validation, set this to false.


*Type:* boolean

*Default:* `true`


## settings.headscale.dns_records_path
*Description:* If you are using `dns.extra_records_path` in your Headscale configuration, you need to set this to the path for Headplane to be able to read the DNS records.
Ensure that the file is both readable and writable by the Headplane process.
When using this, Headplane will no longer need to automatically restart Headscale for DNS record changes.


*Type:* null or absolute path

*Default:* `null`

*Example:* `"/var/lib/headplane/extra_records.json"`


## settings.headscale.public_url
*Description:* Public URL if differrent. This affects certain parts of the web UI.

*Type:* null or string

*Default:* `null`

*Example:* `"https://headscale.example.com"`


## settings.headscale.tls_cert_path
*Description:* Path to a file containing the TLS certificate.


*Type:* null or absolute path

*Default:* `null`

*Example:* `"config.sops.secrets.tls_cert.path"`


## settings.headscale.url
*Description:* The URL to your Headscale instance.
All API requests are routed through this URL.
THIS IS NOT the gRPC endpoint, but the HTTP endpoint.
IMPORTANT: If you are using TLS this MUST be set to `https://`.


*Type:* string

*Default:* `"http://127.0.0.1:8080"`

*Example:* `"https://headscale.example.com"`


## settings.integration
*Description:* Integration configurations for Headplane to interact with Headscale.

*Type:* submodule

*Default:* `{ }`


## settings.integration.agent
*Description:* Agent configuration for the Headplane agent.

*Type:* submodule

*Default:* `{ }`


## settings.integration.agent.cache_path
*Description:* Where to store the agent cache.

*Type:* absolute path

*Default:* `"/var/lib/headplane/agent_cache.json"`


## settings.integration.agent.cache_ttl
*Description:* How long to cache agent information (in milliseconds).
If you want data to update faster, reduce the TTL, but this will increase the frequency of requests to Headscale.


*Type:* signed integer

*Default:* `180000`


## settings.integration.agent.enabled
*Description:* The Headplane agent allows retrieving information about nodes.
This allows the UI to display version, OS, and connectivity data.
You will see the Headplane agent in your Tailnet as a node when it connects.


*Type:* boolean

*Default:* `false`


## settings.integration.agent.host_name
*Description:* Optionally change the name of the agent in the Tailnet

*Type:* string

*Default:* `"headplane-agent"`


## settings.integration.agent.package
*Description:* The headplane-agent package to use.

*Type:* package

*Default:* `pkgs.headplane-agent`


## settings.integration.agent.pre_authkey_path
*Description:* Path to a file containing the agent preauth key.
To connect to your Tailnet, you need to generate a pre-auth key.
This can be done via the web UI or through the `headscale` CLI.


*Type:* null or absolute path

*Default:* `null`

*Example:* `"config.sops.secrets.agent_pre_authkey.path"`


## settings.integration.agent.work_dir
*Description:* Do not change this unless you are running a custom deployment.
The work_dir represents where the agent will store its data to be able to automatically reauthenticate with your Tailnet.
It needs to be writable by the user running the Headplane process.


*Type:* absolute path

*Default:* `"/var/lib/headplane/agent"`


## settings.integration.proc
*Description:* Native process integration settings.

*Type:* submodule

*Default:* `{ }`


## settings.integration.proc.enabled
*Description:* Enable "Native" integration that works when Headscale and
Headplane are running outside of a container. There is no additional
configuration, but you need to ensure that the Headplane process
can terminate the Headscale process.


*Type:* boolean

*Default:* `true`


## settings.oidc
*Description:* OIDC Configuration for authentication.

*Type:* submodule

*Default:* `{ }`


## settings.oidc.client_id
*Description:* The client ID for the OIDC client.

*Type:* string

*Default:* `""`

*Example:* `"your-client-id"`


## settings.oidc.client_secret_path
*Description:* Path to a file containing the OIDC client secret.


*Type:* null or absolute path

*Default:* `null`

*Example:* `"config.sops.secrets.oidc_client_secret.path"`


## settings.oidc.disable_api_key_login
*Description:* Whether to disable API key login.

*Type:* boolean

*Default:* `false`


## settings.oidc.headscale_api_key_path
*Description:* Path to a file containing the Headscale API key.


*Type:* null or absolute path

*Default:* `null`

*Example:* `"config.sops.secrets.headscale_api_key.path"`


## settings.oidc.issuer
*Description:* URL to OpenID issuer.

*Type:* string

*Default:* `""`

*Example:* `"https://provider.example.com/issuer-url"`


## settings.oidc.redirect_uri
*Description:* This should point to your publicly accessible URL
for your Headplane instance with /admin/oidc/callback.


*Type:* string

*Default:* `""`

*Example:* `"https://headscale.example.com/admin/oidc/callback"`


## settings.oidc.token_endpoint_auth_method
*Description:* The token endpoint authentication method.

*Type:* one of "client_secret_post", "client_secret_basic", "client_secret_jwt"

*Default:* `"client_secret_post"`


## settings.oidc.user_storage_file
*Description:* Path to a file containing the users and their permissions for Headplane.


*Type:* absolute path

*Default:* `"/var/lib/headplane/users.json"`

*Example:* `"/var/lib/headplane/users.json"`


## settings.server
*Description:* Server configuration for Headplane web application.

*Type:* submodule

*Default:* `{ }`


## settings.server.cookie_secret_path
*Description:* Path to a file containing the cookie secret.
The secret must be exactly 32 characters long.


*Type:* null or absolute path

*Default:* `null`

*Example:* `"config.sops.secrets.headplane_cookie.path"`


## settings.server.cookie_secure
*Description:* Should the cookies only work over HTTPS?
Set to false if running via HTTP without a proxy.
Recommended to be true in production.


*Type:* boolean

*Default:* `true`


## settings.server.data_path
*Description:* The path to persist Headplane specific data.
All data going forward is stored in this directory, including the internal database and any cache related files.
Data formats prior to 0.6.1 will automatically be migrated.


*Type:* absolute path

*Default:* `"/var/lib/headplane"`

*Example:* `"/var/lib/headplane"`


## settings.server.host
*Description:* The host address to bind to.

*Type:* string

*Default:* `"127.0.0.1"`

*Example:* `"0.0.0.0"`


## settings.server.port
*Description:* The port to listen on.

*Type:* 16 bit unsigned integer; between 0 and 65535 (both inclusive)

*Default:* `3000`

