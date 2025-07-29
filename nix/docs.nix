{
  lib,
  nixosOptionsDoc,
  runCommand,
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
  runCommand "headplane-nixos-docs.md" {} "cat ${optionsDoc.optionsCommonMark} > $out"
