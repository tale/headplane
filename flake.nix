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
      pkgs = import nixpkgs {
        inherit system;
        overlays = [ devshell.overlays.default ];
      };

      # nixpkgs' default go is 1.26.5; go.mod (via tailscale) needs >= 1.26.6.
      buildGoModule = pkgs.buildGoModule.override {go = pkgs.go_1_27;};
    in rec {
      formatter = pkgs.alejandra;
      packages = {
        headplane = pkgs.callPackage ./nix/package.nix {headplane-ssh-wasm = packages.headplane-ssh-wasm;};
        headplane-agent = pkgs.callPackage ./nix/agent.nix {inherit buildGoModule;};
        headplane-nixos-docs = pkgs.callPackage ./nix/docs.nix {};
        headplane-ssh-wasm = pkgs.callPackage ./nix/ssh-wasm.nix {
          inherit buildGoModule;
          go = pkgs.go_1_27;
        };
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
          pkgs.go_1_27
          pkgs.nodejs-slim_24
          pkgs.pnpm_10
          pkgs.typescript-language-server
          pkgs.mise
          pkgs.mkcert
        ];
        env = [];
      };
    })
    // {
      overlays.default = final: prev: let
        buildGoModule = final.buildGoModule.override {go = final.go_1_27;};
      in {
        headplane = final.callPackage ./nix/package.nix {headplane-ssh-wasm = final.headplane-ssh-wasm;};
        headplane-agent = final.callPackage ./nix/agent.nix {inherit buildGoModule;};
        headplane-nixos-docs = final.callPackage ./nix/docs.nix {};
        headplane-ssh-wasm = final.callPackage ./nix/ssh-wasm.nix {
          inherit buildGoModule;
          go = final.go_1_27;
        };
      };
      nixosModules.headplane = import ./nix/module.nix;
    };
}
