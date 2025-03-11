# Nix

[flake.nix](../flake.nix) provided:
```
$ nix flake show . --all-systems
git+file:///home/igor/personal/headplane?ref=refs/heads/nix&rev=2d78a95a0648a3778e114fb246ea436e96475d62
├───devShell
│   ├───aarch64-darwin: development environment 'headplane'
│   ├───x86_64-darwin: development environment 'headplane'
│   └───x86_64-linux: development environment 'headplane'
├───formatter
│   ├───aarch64-darwin: package 'alejandra-3.1.0'
│   ├───x86_64-darwin: package 'alejandra-3.1.0'
│   └───x86_64-linux: package 'alejandra-3.1.0'
├───nixosModules
│   └───headplane: NixOS module
├───overlays
│   └───default: Nixpkgs overlay
└───packages
    ├───aarch64-darwin
    │   ├───headplane: package 'headplane-0.5.3-SNAPSHOT'
    │   └───headplane-agent: package 'hp_agent-0.5.3-SNAPSHOT'
    ├───x86_64-darwin
    │   ├───headplane: package 'headplane-0.5.3-SNAPSHOT'
    │   └───headplane-agent: package 'hp_agent-0.5.3-SNAPSHOT'
    └───x86_64-linux
        ├───headplane: package 'headplane-0.5.3-SNAPSHOT'
        └───headplane-agent: package 'hp_agent-0.5.3-SNAPSHOT'
```

## Usage

```nix
# Your flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    headplane = {
      url = "github:igor-ramazanov/headplane/nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    nixpkgs,
    headplane,
    ...
  }: {
    nixosConfigurations.MY_MACHINE = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        # provides `services.headplane.*` NixOS options.
        headplane.nixosModules.headplane
        {
          # provides `pkgs.headplane` and `pkgs.headplane-agent`.
          nixpkgs.overlays = [ headplane.overlays.default ];
        }
        {
          {config, pkgs, ...}: {
            services.headplane = let
              headscaleConfig =
                (pkgs.formats.yaml {}).generate
                "headscale-for-headplane.yml"
                config.services.headscale.settings;
            in {
              enable = true;
              agent.enable = false;
              settings = {
                server = {
                  host = "127.0.0.1";
                  port = 3000;
                  cookie_secret = "replace me";
                  cookie_secure = true;
                };
                headscale = {
                  url = "https://example.com";
                  config_path = "${headscaleConfig}";
                  config_strict = false;
                };
                integration.proc.enabled = true;
                oidc = {
                  issuer = "https://authelia.example.com";
                  client_id = "headplane";
                  client_secret = "replace me";
                  disable_api_key_login = true;
                  token_endpoint_auth_method = "client_secret_basic";
                  headscale_api_key = "replace me";
                  redirect_uri = "https://authelia.example.com/admin/oidc/callback";
                };
              };
            };
          }
        }
      ];
    };
  };
}
```
