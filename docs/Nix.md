# Nix

[flake.nix](../flake.nix) provided:
```
$ nix flake show . --all-systems
warning: Git tree '/home/erikp/headplane' is dirty
git+file:///home/erikp/headplane
├───checks
│   ├───aarch64-darwin
│   │   └───default: derivation 'headplane-with-agent'
│   ├───x86_64-darwin
│   │   └───default: derivation 'headplane-with-agent'
│   └───x86_64-linux
│       └───default: derivation 'headplane-with-agent'
├───devShells
│   ├───aarch64-darwin
│   │   └───default: development environment 'headplane'
│   ├───x86_64-darwin
│   │   └───default: development environment 'headplane'
│   └───x86_64-linux
│       └───default: development environment 'headplane'
├───formatter
│   ├───aarch64-darwin: package 'alejandra-4.0.0'
│   ├───x86_64-darwin: package 'alejandra-4.0.0'
│   └───x86_64-linux: package 'alejandra-4.0.0'
├───nixosModules
│   └───headplane: NixOS module
├───overlays
│   └───default: Nixpkgs overlay
└───packages
    ├───aarch64-darwin
    │   ├───headplane: package 'headplane-0.5.10'
    │   └───headplane-agent: package 'hp_agent-0.5.10'
    ├───x86_64-darwin
    │   ├───headplane: package 'headplane-0.5.10'
    │   └───headplane-agent: package 'hp_agent-0.5.10'
    └───x86_64-linux
        ├───headplane: package 'headplane-0.5.10'
        └───headplane-agent: package 'hp_agent-0.5.10'
```

## NixOS module options

The Headplane NixOS module provides the following options under `services.headplane`:

### Top-level options

- **enable** (`bool`, default: `false`)
  > Whether to enable the Headplane service.

- **package** (`package`, default: `pkgs.headplane`)
  > The Headplane package to use.

- **settings** (submodule)
  > Headplane configuration options. Generates a YAML config file. See: https://github.com/tale/headplane/blob/main/config.example.yaml

  #### settings.server
  - **host** (`string`, default: `"0.0.0.0"`)
    > The host address to bind to. Example: `"127.0.0.1"`
  - **port** (`port`, default: `3000`)
    > The port to listen on.
  - **cookie_secret** (`null or string`, default: `null`)
    > The secret used to encode and decode web sessions. Ensure that this is exactly 32 characters long. Can be either a direct string or a path to a file containing the secret. Example: `config.sops.secrets.headplane.path`
  - **cookie_secret_path** (`null or path`, default: `null`)
    > Path to a file containing the cookie secret. The secret must be exactly 32 characters long. Can be used instead of cookie_secret. Example: `config.sops.secrets.headplane_cookie.path`
  - **cookie_secure** (`bool`, default: `true`)
    > Should the cookies only work over HTTPS? Set to false if running via HTTP without a proxy. Recommended to be true in production.
  - **agent** (submodule)
    > Agent configuration for the Headplane agent.
    - **authkey** (`null or string`, default: `null`)
      > The auth key used to authenticate the agent with Headplane. Can be either a direct string or a path to a file containing the key. Example: `config.sops.secrets.agent_authkey.path`
    - **authkey_path** (`null or path`, default: `null`)
      > Path to a file containing the agent auth key. Can be used instead of authkey. Example: `config.sops.secrets.agent_authkey.path`
    - **ttl** (`int`, default: `180000`)
      > How long to cache agent information (in milliseconds).
    - **cache_path** (`string`, default: `"/var/lib/headplane/agent_cache.json"`)
      > Where to store the agent cache.

  #### settings.headscale
  - **url** (`string`, default: `"http://127.0.0.1:8080"`)
    > The URL to your Headscale instance. All API requests are routed through this URL. THIS IS NOT the gRPC endpoint, but the HTTP endpoint. IMPORTANT: If you are using TLS this MUST be set to `https://`. Example: `https://headscale.example.com`
  - **tls_cert** (`null or string`, default: `null`)
    > TLS certificate for HTTPS connections. Can be either a direct string or a path to a file containing the certificate. Example: `config.sops.secrets.tls_cert.path`
  - **tls_cert_path** (`null or path`, default: `null`)
    > Path to a file containing the TLS certificate. Can be used instead of tls_cert. Example: `config.sops.secrets.tls_cert.path`
  - **tls_key** (`null or string`, default: `null`)
    > TLS private key for HTTPS connections. Can be either a direct string or a path to a file containing the key. Example: `config.sops.secrets.tls_key.path`
  - **tls_key_path** (`null or path`, default: `null`)
    > Path to a file containing the TLS private key. Can be used instead of tls_key. Example: `config.sops.secrets.tls_key.path`
  - **config_path** (`null or path`, default: `null`)
    > Path to the Headscale configuration file. This is optional, but HIGHLY recommended for the best experience. If this is read only, Headplane will show your configuration settings in the Web UI, but they cannot be changed. Example: `/etc/headscale/config.yaml`
  - **config_strict** (`bool`, default: `true`)
    > Headplane internally validates the Headscale configuration to ensure that it changes the configuration in a safe way. If you want to disable this validation, set this to false.

  #### settings.integration
  - **proc** (submodule)
    > Native process integration settings.
    - **enabled** (`bool`, default: `false`)
      > Enable "Native" integration that works when Headscale and Headplane are running outside of a container. There is no additional configuration, but you need to ensure that the Headplane process can terminate the Headscale process.

  #### settings.oidc
  - **issuer** (`string`, default: `""`)
    > URL to OpenID issuer. Example: `https://authentik.parawell.cloud/application/o/test-headscale/`
  - **client_id** (`string`, default: `""`)
    > The client ID for the OIDC client. Example: `your-client-id`
  - **client_secret** (`null or string`, default: `null`)
    > The client secret for the OIDC client. Example: `config.sops.secrets.oidc_secret.path`
  - **client_secret_path** (`null or path`, default: `null`)
    > Path to a file containing the OIDC client secret. Can be used instead of client_secret. Example: `config.sops.secrets.oidc_client_secret.path`
  - **disable_api_key_login** (`bool`, default: `false`)
    > Whether to disable API key login.
  - **token_endpoint_auth_method** (`enum ["client_secret_post", "client_secret_basic"]`, default: `"client_secret_post"`)
    > The token endpoint authentication method.
  - **headscale_api_key** (`null or string`, default: `null`)
    > If you are using OIDC, you need to generate an API key that can be used to authenticate other sessions when signing in. This can be done with `headscale apikeys create --expiration 999d`. Example: `config.sops.secrets.headscale_api_key.path`
  - **headscale_api_key_path** (`null or path`, default: `null`)
    > Path to a file containing the Headscale API key. Can be used instead of headscale_api_key. Example: `config.sops.secrets.headscale_api_key.path`
  - **redirect_uri** (`string`)
    > This should point to your publicly accessible URL for your Headplane instance with /admin/oidc/callback. Example: `https://headscale.example.com/admin/oidc/callback`

- **agent** (submodule)
  > Standalone agent configuration.
  - **enable** (`bool`, default: `false`)
    > Whether to enable the Headplane agent.
  - **package** (`package`, default: `pkgs.headplane-agent`)
    > The Headplane agent package to use.
  - **settings** (`attrsOf string or bool`, default: `{}`)
    > Headplane agent env vars config. See: https://github.com/tale/headplane/blob/main/docs/Headplane-Agent.md

## Usage

1. Add the Headplane flake input to your `flake.nix`:
   ```nix
   {
     inputs = {
       nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
       headplane = {
         url = "github:tale/headplane";
         inputs.nixpkgs.follows = "nixpkgs";
       };
     };

     outputs = { nixpkgs, headplane, ... }: {
       nixosConfigurations.your-hostname = nixpkgs.lib.nixosSystem {
         system = "x86_64-linux";  # or your system architecture
         modules = [
           # Import the Headplane NixOS module to get access to services.headplane.* options
           headplane.nixosModules.headplane
           
           # Add the Headplane overlay to make pkgs.headplane and pkgs.headplane-agent available
           {
             nixpkgs.overlays = [ headplane.overlays.default ];
           }

           # Your Headplane configuration
           ({ config, pkgs, lib, ... }: {
             services.headplane = {
               enable = true;

               # Configure the standalone Headplane Agent
               agent = {
                 enable = false;  # Set to true if you want to run the agent (not ready yet as of writing this doc)
               };

               # Configure the Headplane server application
               settings = {
                 server = {
                   # host = "127.0.0.1";
                   # port = 3000;
                   cookie_secret_path = config.sops.secrets.headplane_cookie_secret.path;
                   cookie_secure = true;

                   agent = {
                    enabled = false;
                     # authkey_path = config.sops.secrets.headplane_server_agent_authkey.path;
                     # ttl = 180000; # milliseconds
                     # cache_path = "/var/lib/headplane/agent_cache.json";
                   };
                 };

                 headscale = {
                   # url = "http://127.0.0.1:8080";
                   config_path = headscaleConfig;  # Use the generated config file
                   # config_strict = true;
                   # tls_cert = "your-tls-cert";  # Alternative to tls_cert_path
                   # tls_cert_path = config.sops.secrets.headplane_tls_cert.path;
                   # tls_key = "your-tls-key";  # Alternative to tls_key_path
                   # tls_key_path = config.sops.secrets.headplane_tls_key.path;
                 };

                 oidc = {
                   # issuer = "";
                   # client_id = ""; 
                   # client_secret_path = config.sops.secrets.headplane_oidc_client_secret.path;
                   # client_secret = "your_oidc_client_secret";  # Alternative to client_secret_path
                   # disable_api_key_login = false;
                   # token_endpoint_auth_method = "client_secret_post";
                   # headscale_api_key_path = config.sops.secrets.headplane_headscale_api_key.path;
                   # headscale_api_key = "your_headscale_api_key";  # Alternative to headscale_api_key_path
                   # redirect_uri = "";
                 };
               };
             };
           })
         ];
       };
     };
   }
   ```

For more details about each option, refer to the options documentation above.
