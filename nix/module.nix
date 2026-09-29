{
  config,
  lib,
  pkgs,
  ...
}: let
  inherit
    (lib)
    filterAttrs
    filterAttrsRecursive
    mkIf
    recursiveUpdate
    updateManyAttrsByPath
    ;
  cfg = config.services.headplane;
  settingsFormat = pkgs.formats.yaml {};
  settingsWithAgentExecutablePath = recursiveUpdate cfg.settings {
    integration.agent.executable_path = "${cfg.settings.integration.agent.package}/bin/hp_agent";
  };
  settingsWithoutAgentPackage =
    updateManyAttrsByPath [
      {
        path = ["integration" "agent"];
        update = old: filterAttrs (key: value: key != "package") old;
      }
    ]
    settingsWithAgentExecutablePath;
  settingsWithoutNulls = filterAttrsRecursive (key: value: value != null) settingsWithoutAgentPackage;
  settingsWithoutEmptyOidc = 
    if settingsWithoutNulls ? oidc && 
       ((settingsWithoutNulls.oidc.issuer or "") == "" && (settingsWithoutNulls.oidc.client_id or "") == "") then
      builtins.removeAttrs settingsWithoutNulls ["oidc"]
    else
      settingsWithoutNulls;
  # `settings.server` is a submodule, so `jwt_auth` is always materialized with
  # its defaults. The schema requires header/issuer/jwks_url/audience, which
  # would reject every deployment that does not use it.
  settingsWithoutDisabledJwtAuth =
    if settingsWithoutEmptyOidc ? server
       && settingsWithoutEmptyOidc.server ? jwt_auth
       && !(settingsWithoutEmptyOidc.server.jwt_auth.enabled or false)
    then
      settingsWithoutEmptyOidc
      // {
        server = builtins.removeAttrs settingsWithoutEmptyOidc.server ["jwt_auth"];
      }
    else
      settingsWithoutEmptyOidc;
  settingsFile = settingsFormat.generate "headplane-config.yaml" settingsWithoutDisabledJwtAuth;
in {
  imports = [./options.nix];
  config = mkIf cfg.enable {
    environment = {
      systemPackages = [cfg.package];
      etc."headplane/config.yaml".source = "${settingsFile}";
    };

    systemd.services.headplane = {
      description = "Headscale Web UI";

      wantedBy = ["multi-user.target"];
      after = ["headscale.service"];
      requires = ["headscale.service"];

      environment = {HEADPLANE_DEBUG_LOG = builtins.toString cfg.debug;};

      serviceConfig = {
        User = config.services.headscale.user;
        Group = config.services.headscale.group;
        StateDirectory = "headplane";

        ExecStart = "${cfg.package}/bin/headplane";
        Restart = "always";
        RestartSec = 5;

        # TODO: Harden `systemd` security according to the "The Principle of Least Power".
        # See: `$ systemd-analyze security headplane`.
      };
    };
  };
}
