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
      headplane = pkgs.callPackage ./nix/package.nix {};
    in {
      formatter = pkgs.alejandra;
      packages = {
        inherit headplane;
        default = headplane;
      };
      devShell = pkgs.devshell.mkShell rec {
        name = description;
        motd = let
          providedPackages =
            pkgs.lib.fold
            (pkg: acc: acc + "\n\t* ${pkgs.lib.getName pkg}")
            ""
            packages;
        in ''
          Entered '${description}' development environment.

          Provided packages:
          ${providedPackages}
        '';
        packages = [
          pkgs.nodejs-slim_22
          pkgs.pnpm_10
          pkgs.typescript-language-server
        ];
        env = [];
      };
    })
    // {
      overlays.default = final: prev: {headplane = final.callPackage ./nix/package.nix {};};
      nixosModules.headplane = import ./nix/module.nix;
    };
}
