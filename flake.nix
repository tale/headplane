rec {
  description = "headplane";

  inputs = {
    devshell = {
      inputs.nixpkgs.follows = "nixpkgs";
      url = "github:numtide/devshell";
    };
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
  };

  outputs = {
    devshell,
    flake-utils,
    nixpkgs,
    ...
  }:
    flake-utils.lib.eachSystem [
      "aarch64-darwin"
      "x86_64-darwin"
      "x86_64-linux"
    ]
    (system: let
      # Overlay: bump go_1_25 to 1.25.1 while nixpkgs-unstable lags behind
      # https://nixpk.gs/pr-tracker.html?pr=441125 / https://github.com/NixOS/nixpkgs/pull/441125
      # https://github.com/NixOS/nixpkgs/issues/440982
      go1251Overlay = (final: prev:
        let
          newVersion = "1.25.1";
        in {
          go_1_25 = prev.go_1_25.overrideAttrs (old: {
            version = newVersion;
            src = prev.fetchurl {
              url = "https://go.dev/dl/go${newVersion}.src.tar.gz";
              hash = "sha256-0BDBCc7pTYDv5oHqtGvepJGskGv0ZYPDLp8NuwvRpZQ=";
            };
          });
          # ensure pkgs.go resolves to the bumped compiler
          go = final.go_1_25;
        });
      pkgs = import nixpkgs {
        inherit system;
        overlays = [
          devshell.overlays.default
          go1251Overlay
        ];
      };
    in rec {
      formatter = pkgs.alejandra;
      packages = {
        headplane = pkgs.callPackage ./nix/package.nix {headplane-ssh-wasm = packages.headplane-ssh-wasm;};
        headplane-agent = pkgs.callPackage ./nix/agent.nix {};
        headplane-nixos-docs = pkgs.callPackage ./nix/docs.nix {};
        headplane-ssh-wasm = pkgs.callPackage ./nix/ssh-wasm.nix {};
      };
      checks.default = pkgs.symlinkJoin {
        name = "headplane-with-agent";
        paths = [packages.headplane packages.headplane-agent];
      };
      devShells.default = pkgs.devshell.mkShell rec {
        name = description;
        motd = let
          providedPackages = pkgs.lib.concatStringsSep "\n" (
            pkgs.lib.map
            (pkg: "\t* ${pkgs.lib.getName pkg}")
            (pkgs.lib.reverseList packages)
          );
        in ''
          Entered '${description}' development environment.

          Provided packages:
          ${providedPackages}
        '';
        packages = [
          pkgs.go
          pkgs.nodejs-slim_22
          pkgs.pnpm_10
          pkgs.typescript-language-server
          pkgs.mise
          pkgs.mkcert
        ];
        env = [];
      };
    })
    // {
      overlays.default = final: prev: {
        headplane = final.callPackage ./nix/package.nix {headplane-ssh-wasm = final.headplane-ssh-wasm;};
        headplane-agent = final.callPackage ./nix/agent.nix {};
        headplane-nixos-docs = final.callPackage ./nix/docs.nix {};
        headplane-ssh-wasm = final.callPackage ./nix/ssh-wasm.nix {};
      };
      nixosModules.headplane = import ./nix/module.nix;
    };
}
