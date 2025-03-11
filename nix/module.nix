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
in {
  options.services.headplane = {
    enable = mkEnableOption "headplane";
    package = mkPackageOption pkgs "headplane" {};

    settings = mkOption {
      type = with types; attrsOf (oneOf [str int bool]);
      default = {};
    };

    agent = mkOption {
      type = types.submodule {
        options = {
          enable = mkEnableOption "headplane-agent";
          package = mkPackageOption pkgs "headplane-agent" {};
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
            description = "The URL to your Headplane instance.";
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

    environment.etc."headplane/config.yaml".source = let
      format = pkgs.formats.yaml {};
      headplaneConfig = format.generate "headplane-config.yaml" cfg.settings;
    in "${headplaneConfig}";

    systemd.services.headplane-agent =
      mkIf cfg.agent.enable
      {
        description = "Headplane side-running agent";

        wantedBy = ["multi-user.target"];
        after = ["headplane.service"];
        requires = ["headplane.service"];

        environment = {
          HP_AGENT_HOSTNAME = cfg.agent.hostname;
          HP_AGENT_TS_SERVER = cfg.agent.tsServer;
          HP_AGENT_TS_AUTHKEY = cfg.agent.tsAuthkey;
          HP_AGENT_HP_SERVER = cfg.agent.hpServer;
          HP_AGENT_HP_AUTHKEY = cfg.agent.hpAuthkey;
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
