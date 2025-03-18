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
        overlays = [devshell.overlays.default];
      };
    in rec {
      formatter = pkgs.alejandra;
      packages = {
        headplane = pkgs.callPackage ./nix/package.nix {};
        headplane-agent = pkgs.callPackage ./nix/agent.nix {};
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
        ];
        env = [];
      };
    })
    // {
      overlays.default = final: prev: {
        headplane = final.callPackage ./nix/package.nix {};
        headplane-agent = final.callPackage ./nix/agent.nix {};
      };
      nixosModules.headplane = import ./nix/module.nix;
    };
}
