---
title: Nix/NixOS
description: Run Headplane on NixOS with the flake and its NixOS module.
---

# Nix/NixOS

The repository's [flake](https://github.com/tale/headplane/blob/main/flake.nix)
provides an overlay with `pkgs.headplane` and `pkgs.headplane-agent`, and a
NixOS module that runs Headplane as a systemd service under
`services.headplane`. Run `nix flake show github:tale/headplane` to list
everything it exports.

## Usage

Add the flake as an input, then import its module and overlay:

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
    nixosConfigurations.my-machine = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        headplane.nixosModules.headplane
        { nixpkgs.overlays = [ headplane.overlays.default ]; }
        ({ config, pkgs, ... }: {
          services.headplane = {
            enable = true;
            settings = {
              server = {
                host = "127.0.0.1";
                port = 3000;
                # Any file with the secret works, sops-nix is just an example
                cookie_secret_path = config.sops.secrets."headplane/cookieSecret".path;
              };
              headscale = {
                url = "https://headscale.example.com";
                api_key_path = config.sops.secrets."headplane/headscaleApiKey".path;
                config_path = (pkgs.formats.yaml { }).generate "headscale.yaml"
                  config.services.headscale.settings;
              };
              integration.agent.enabled = true;
            };
          };
        })
      ];
    };
  };
}
```

The module writes `settings` to `/etc/headplane/config.yaml`, so every option
from the [configuration file](/configuration) is available under
`services.headplane.settings`. The [NixOS options](/reference/nixos-options)
reference lists them all. It also points the agent at its Nix package, so
`integration.agent.enabled = true` is all the agent needs.

## How it runs

The service runs as the Headscale user and starts after `headscale.service`.
It enables the [proc integration](/configuration/integrations#proc) by default,
which restarts Headscale through systemd when settings change in the UI.

Generating `headscale.config_path` from `services.headscale.settings`, as
above, puts the file in the Nix store, which is read-only. Headplane shows
Headscale's DNS settings without changing them and hides sign-in restrictions,
so keep managing both in the Nix configuration. DNS records are the exception:
point Headscale's `dns.extra_records_path` at a writable file outside the store
and Headplane can edit them.

Set `services.headplane.debug = true` for debug logs.
