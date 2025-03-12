{
  config,
  pkgs,
  lib,
  ...
}: let
  inherit
    (lib)
    mkEnableOption
    mkIf
    mkOption
    mkPackageOption
    types
    ;
  cfg = config.services.headplane;
  settingsFormat = pkgs.formats.yaml {};
  settingsFile = settingsFormat.generate "headplane-config.yaml" cfg.settings;
in {
  options.services.headplane = {
    enable = mkEnableOption "headplane";
    package = mkPackageOption pkgs "headplane" {};

    settings = mkOption {
      type = types.submodule {
        freeformType = settingsFormat.type;
      };
      default = {};
    };

    agent = mkOption {
      type = types.submodule {
        options = {
          enable = mkEnableOption "headplane-agent";
          package = mkPackageOption pkgs "headplane-agent" {};
          debug = mkOption {
            type = types.bool;
            description = "Enable debug logging if true.";
          };
          hostname = mkOption {
            type = types.str;
            description = "A hostname you want to use for the agent.";
          };
          tsServer = mkOption {
            type = types.str;
            description = "The URL to your Headscale instance.";
          };
          tsAuthKey = mkOption {
            type = types.str;
            description = "An authorization key to authenticate with Headscale (see below).";
          };
          hpServer = mkOption {
            type = types.str;
            description = "The URL to your Headplane instance, including the subpath (eg. https://headplane.example.com/admin).";
          };
          hpAuthKey = mkOption {
            type = types.str;
            description = "The generated auth key to authenticate with Headplane.";
          };
        };
      };
    };
  };

  config = mkIf cfg.enable {
    environment.systemPackages = [cfg.package];

    environment.etc."headplane/config.yaml".source = "${settingsFile}";

    systemd.services.headplane-agent =
      mkIf cfg.agent.enable
      {
        description = "Headplane side-running agent";

        wantedBy = ["multi-user.target"];
        after = ["headplane.service"];
        requires = ["headplane.service"];

        environment = {
          HEADPLANE_AGENT_DEBUG =
            if cfg.agent.debug
            then "true"
            else "false";
          HEADPLANE_AGENT_HOSTNAME = cfg.agent.hostname;
          HEADPLANE_AGENT_TS_SERVER = cfg.agent.tsServer;
          HEADPLANE_AGENT_TS_AUTHKEY = cfg.agent.tsAuthkey;
          HEADPLANE_AGENT_HP_SERVER = cfg.agent.hpServer;
          HEADPLANE_AGENT_HP_AUTHKEY = cfg.agent.hpAuthkey;
        };

        serviceConfig = {
          User = config.services.headscale.user;
          Group = config.services.headscale.group;

          ExecStart = "${pkgs.headplane-agent}/bin/hp_agent";
          Restart = "always";
          RestartSec = 5;

          # TODO: Harden `systemd` security according to the "The Principle of Least Power".
          # See: `$ systemd-analyze security headplane`.
        };
      };

    systemd.services.headplane = {
      description = "Headscale Web UI";

      wantedBy = ["multi-user.target"];
      after = ["headscale.service"];
      requires = ["headscale.service"];

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
