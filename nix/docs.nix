{
  lib,
  nixosOptionsDoc,
  runCommand,
  nodejs,
  ...
}: let
  eval = lib.evalModules {
    modules = [./options.nix];
  };
  transformOptions = opt:
    if (lib.hasPrefix "_" opt.name)
    then
      opt
      // {
        internal = true;
        visible = false;
      }
    else opt;
  optionsDoc = nixosOptionsDoc {
    inherit (eval) options;
    inherit transformOptions;
  };
in
  runCommand "headplane-nixos-docs.json" {} ''
    ${nodejs}/bin/node ${./docs.js} ${optionsDoc.optionsJSON}/share/doc/nixos/options.json > $out
  ''
