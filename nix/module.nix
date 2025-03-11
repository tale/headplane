{
  config,
  pkgs,
  lib,
  ...
}: let
  inherit
    (lib)
    mapAttrs
    mkEnableOption
    mkIf
    mkOption
    mkPackageOption
    types
    ;
  cfg = config.services.headplane;
in {
  options.services.headplane = {
    enable = mkEnableOption "headplane";
    package = mkPackageOption pkgs "headplane" {};

    settings = mkOption {
      type = with types; attrsOf (oneOf [str int]);
      default = {};
    };
  };

  config = mkIf cfg.enable {
    environment.systemPackages = [cfg.package];

    systemd.services.headplane = {
      description = "Headscale Web UI";

      wantedBy = ["multi-user.target"];
      after = ["network.target" "headscale.service"];

      environment = mapAttrs (_: toString) cfg.settings;

      serviceConfig = {
        User = config.services.headscale.user;
        Group = config.services.headscale.group;

        ExecStart = "${pkgs.headplane}/bin/headplane";
        Restart = "always";
        RestartSec = 5;

        # TODO: Harden `systemd` security according to the "The Principle of Least Power".
        # See: `$ systemd-analyze security headplane`.
      };
    };
  };
}
