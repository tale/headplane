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
The Headplane NixOS module provides comprehensive options under `services.headplane.*` to configure both the Headplane server and the optional standalone agent.

As of Headplane version 0.5.10 (corresponding to these updates), the NixOS module explicitly defines most configuration settings found in the `config.example.yaml`. This means you can inspect all available options, their types, default values, and descriptions directly using standard NixOS tools:
- Use `nix repl` and query the options: `nix-repl> :o services.headplane`.

Key configuration is done under `services.headplane.settings`, which mirrors the structure of the YAML configuration file. For example, `services.headplane.settings.server.port` corresponds to `server.port` in the YAML.

Refer to the [Configuration.md](./Configuration.md) for details on what each YAML setting does. The NixOS option descriptions will also guide you.

## Usage

1. Add the Headplane flake input to your `flake.nix`. For stability, it's recommended to use a specific branch (like `main` or a release tag if available) from the official repository.
   ```nix
   # Your flake.nix
   inputs = {
     nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable"; # Or your preferred nixpkgs channel
     headplane = {
       url = "github:tale/headplane"; # Official repository
       # For the very latest NixOS module enhancements (e.g., those in v0.5.10 with detailed options),
       # if not yet merged into main/master or a release tag on tale/headplane,
       # you might temporarily use a specific development branch, for example:
       # url = "github:StealthBadger747/headplane/erikp/implement-path-loader";
       inputs.nixpkgs.follows = "nixpkgs";
     };
   };
   ```
   Note: Headplane is typically added as a flake input and is not usually available directly from the main nixpkgs channels.

2. Import the Headplane NixOS module and, if needed, the overlay in your NixOS configuration:
   ```nix
   # In your NixOS configuration (e.g., modules/my-headplane-config.nix)
   { config, pkgs, lib, ... }:
   {
     imports = [
       # Provides `services.headplane.*` NixOS options.
       config.inputs.headplane.nixosModules.headplane
     ];

     # Optional: If you need to reference pkgs.headplane or pkgs.headplane-agent directly
     # and it's not already provided by your Nixpkgs version or another overlay.
     # nixpkgs.overlays = lib.optionals (config.services.headplane.enable || config.services.headplane.agent.enable) [
     #   config.inputs.headplane.overlays.default
     # ];
     # A simpler way if you always want it:
     # nixpkgs.overlays = [ config.inputs.headplane.overlays.default ];

     # Example Headplane Configuration (adapt to your needs):
     services.headplane = {
       enable = true; # Enable the Headplane server service

       # Configure the standalone Headplane Agent (optional)
       agent = {
         enable = false; # Set to true to enable the Go-based agent
         # package = pkgs.headplane-agent; # Usually inferred
         settings = {
           # These are environment variables for the agent service
           # Refer to Headplane-Agent.md for details on these settings
           # Example:
           # HEADPLANE_AGENT_DEBUG = true;
           # HEADPLANE_AGENT_HOSTNAME = "my-headscale-node";
           # HEADPLANE_AGENT_TS_SERVER = config.services.headscale.settings.server_url; # If on same machine
           # HEADPLANE_AGENT_TS_AUTHKEY = "tskey-yourTailscaleAuthKey";
           # HEADPLANE_AGENT_HP_SERVER = "${config.services.headplane.settings.server_url}/admin/dns"; # Example
           # HEADPLANE_AGENT_HP_AUTHKEY = "hpkey-yourHeadplaneAgentAuthKey";
         };
       };

       # Configure the Headplane server application (via generated config.yaml)
       settings = {
         server = {
           host = "127.0.0.1"; # Headplane will listen on this address
           port = 3000;
           # Example using sops-nix for the cookie secret:
           # cookie_secret_path = config.sops.secrets.headplane_cookie_secret.path;
           # Or directly (ensure it's a secure, 32-char random string):
           cookie_secret = "your-very-secure-32-character-long-secret";
           cookie_secure = true; # Recommended if behind HTTPS proxy

           agent = {
             # For the server's internal agent features.
             # These are optional. If authkey/authkey_path are not set,
             # internal agent support is disabled. See Configuration.md.
             # authkey_path = config.sops.secrets.headplane_server_agent_authkey.path;
             # ttl = 180000; # Default is 180000 ms
             # cache_path = "/var/lib/headplane/agent_cache.json"; # Default
           };
         };

         headscale = {
           # URL of your Headscale instance (HTTP endpoint)
           url = config.services.headscale.settings.server_url; # If headscale is on the same machine & configured via NixOS
           # Path to Headscale's config.yaml, if Headplane needs to read/write it
           # config_path = "/etc/headscale/config.yaml"; # Or pkgs.headscale.configFormat.generate ...
           config_strict = false; # Set to true if Headplane should strictly validate Headscale's config
                                 # (may require all paths in Headscale config to be absolute & readable by Headplane)
         };

         integration.proc.enabled = config.services.headscale.enable; # Enable if Headscale runs as a local process

         oidc = {
           # Example OIDC configuration (e.g., with Authentik)
           issuer = "https://authentik.example.com/application/o/headplane/";
           client_id = "your_oidc_client_id";
           # client_secret_path = config.sops.secrets.headplane_oidc_client_secret.path;
           client_secret = "your_very_long_and_secure_oidc_client_secret";
           
           disable_api_key_login = false;
           token_endpoint_auth_method = "client_secret_basic"; # or "client_secret_post"

           # API key for Headscale that Headplane uses internally with OIDC flow
           # headscale_api_key_path = config.sops.secrets.headplane_headscale_api_key.path;
           headscale_api_key = "your_headscale_api_key_for_headplane_oidc";

           # Ensure this matches exactly what's in your OIDC provider's redirect URI list
           redirect_uri = "https://headplane.example.com/admin/oidc/callback"; # Adjust your FQDN and path
         };
         # Add other settings from config.example.yaml as needed, e.g.:
         # debug = false;
       };
     };

     # Example sops-nix secret definition (if using sops-nix)
     # sops.secrets.headplane_cookie_secret = {
     #   owner = config.services.headplane.user; # Ensure Headplane can read it
     #   group = config.services.headplane.group;
     # };
     # sops.secrets.headplane_oidc_client_secret = { ... };
     # sops.secrets.headplane_headscale_api_key = { ... };
     # sops.secrets.headplane_server_agent_authkey = { ... };
   }
   ```
