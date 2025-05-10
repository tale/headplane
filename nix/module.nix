{
  config,
  lib,
  pkgs,
  ...
}: let
  inherit
    (lib)
    attrsToList
    listToAttrs
    map
    mkEnableOption
    mkIf
    mkOption
    mkPackageOption
    typeOf
    types
    ;
  cfg = config.services.headplane;
  settingsFormat = pkgs.formats.yaml {};
  settingsFile = settingsFormat.generate "headplane-config.yaml" cfg.settings;
  agentEnv = listToAttrs (map (n: {
    name = n.name;
    value =
      if ((typeOf n.value) == "bool")
      then
        (
          if (n.value)
          then "true"
          else "false"
        )
      else n.value;
  }) (attrsToList cfg.agent.settings));
in {
  options.services.headplane = {
    enable = mkEnableOption "headplane";
    package = mkPackageOption pkgs "headplane" {};

    settings = lib.mkOption {
      description = ''
        Headplane configuration options. Generates a YAML config file.
        See: https://github.com/tale/headplane/blob/main/config.example.yaml
      '';
      type = lib.types.submodule {
        freeformType = settingsFormat.type;

        options = {
          server = lib.mkOption {
            type = lib.types.submodule {
              options = {
                host = lib.mkOption {
                  type = lib.types.str;
                  default = "0.0.0.0";
                  description = "The host address to bind to.";
                  example = "127.0.0.1";
                };

                port = lib.mkOption {
                  type = lib.types.port;
                  default = 3000;
                  description = "The port to listen on.";
                };

                cookie_secret = lib.mkOption {
                  type = lib.types.nullOr lib.types.str;
                  default = null;
                  description = ''
                    The secret used to encode and decode web sessions.
                    Ensure that this is exactly 32 characters long.
                    Can be either a direct string or a path to a file containing the secret.
                  '';
                  example = "config.sops.secrets.headplane.path";
                };

                cookie_secret_path = lib.mkOption {
                  type = lib.types.nullOr lib.types.path;
                  default = null;
                  description = ''
                    Path to a file containing the cookie secret.
                    The secret must be exactly 32 characters long.
                    Can be used instead of cookie_secret.
                  '';
                  example = "config.sops.secrets.headplane_cookie.path";
                };

                cookie_secure = lib.mkOption {
                  type = lib.types.bool;
                  default = true;
                  description = ''
                    Should the cookies only work over HTTPS?
                    Set to false if running via HTTP without a proxy.
                    Recommended to be true in production.
                  '';
                };

                agent = lib.mkOption {
                  type = lib.types.submodule {
                    options = {
                      authkey = lib.mkOption {
                        type = lib.types.nullOr lib.types.str;
                        default = null;
                        description = ''
                          The auth key used to authenticate the agent with Headplane.
                          Can be either a direct string or a path to a file containing the key.
                        '';
                        example = "config.sops.secrets.agent_authkey.path";
                      };

                      authkey_path = lib.mkOption {
                        type = lib.types.nullOr lib.types.path;
                        default = null;
                        description = ''
                          Path to a file containing the agent auth key.
                          Can be used instead of authkey.
                        '';
                        example = "config.sops.secrets.agent_authkey.path";
                      };

                      ttl = lib.mkOption {
                        type = lib.types.int;
                        default = 180000;
                        description = "How long to cache agent information (in milliseconds).";
                      };

                      cache_path = lib.mkOption {
                        type = lib.types.str;
                        default = "/var/lib/headplane/agent_cache.json";
                        description = "Where to store the agent cache.";
                      };
                    };
                  };
                  default = {};
                  description = "Agent configuration for the Headplane agent.";
                };
              };
            };
            default = {};
            description = "Server configuration for Headplane web application.";
          };

          headscale = lib.mkOption {
            type = lib.types.submodule {
              options = {
                url = lib.mkOption {
                  type = lib.types.str;
                  default = "http://127.0.0.1:8080";
                  description = ''
                    The URL to your Headscale instance.
                    All API requests are routed through this URL.
                    THIS IS NOT the gRPC endpoint, but the HTTP endpoint.
                    IMPORTANT: If you are using TLS this MUST be set to `https://`.
                  '';
                  example = "https://headscale.example.com";
                };

                tls_cert = lib.mkOption {
                  type = lib.types.nullOr lib.types.str;
                  default = null;
                  description = ''
                    TLS certificate for HTTPS connections.
                    Can be either a direct string or a path to a file containing the certificate.
                  '';
                  example = "config.sops.secrets.tls_cert.path";
                };

                tls_cert_path = lib.mkOption {
                  type = lib.types.nullOr lib.types.path;
                  default = null;
                  description = ''
                    Path to a file containing the TLS certificate.
                    Can be used instead of tls_cert.
                  '';
                  example = "config.sops.secrets.tls_cert.path";
                };

                tls_key = lib.mkOption {
                  type = lib.types.nullOr lib.types.str;
                  default = null;
                  description = ''
                    TLS private key for HTTPS connections.
                    Can be either a direct string or a path to a file containing the key.
                  '';
                  example = "config.sops.secrets.tls_key.path";
                };

                tls_key_path = lib.mkOption {
                  type = lib.types.nullOr lib.types.path;
                  default = null;
                  description = ''
                    Path to a file containing the TLS private key.
                    Can be used instead of tls_key.
                  '';
                  example = "config.sops.secrets.tls_key.path";
                };

                config_path = lib.mkOption {
                  type = lib.types.nullOr lib.types.path;
                  default = null;
                  description = ''
                    Path to the Headscale configuration file.
                    This is optional, but HIGHLY recommended for the best experience.
                    If this is read only, Headplane will show your configuration settings
                    in the Web UI, but they cannot be changed.
                  '';
                  example = "/etc/headscale/config.yaml";
                };

                config_strict = lib.mkOption {
                  type = lib.types.bool;
                  default = true;
                  description = ''
                    Headplane internally validates the Headscale configuration
                    to ensure that it changes the configuration in a safe way.
                    If you want to disable this validation, set this to false.
                  '';
                };
              };
            };
            default = {};
            description = "Headscale specific settings for Headplane integration.";
          };

          integration = lib.mkOption {
            type = lib.types.submodule {
              options = {
                proc = lib.mkOption {
                  type = lib.types.submodule {
                    options = {
                      enabled = lib.mkOption {
                        type = lib.types.bool;
                        default = false;
                        description = ''
                          Enable "Native" integration that works when Headscale and
                          Headplane are running outside of a container. There is no additional
                          configuration, but you need to ensure that the Headplane process
                          can terminate the Headscale process.
                        '';
                      };
                    };
                  };
                  default = {};
                  description = "Native process integration settings.";
                };
              };
            };
            default = {};
            description = "Integration configurations for Headplane to interact with Headscale.";
          };

          oidc = lib.mkOption {
            type = lib.types.submodule {
              options = {
                issuer = lib.mkOption {
                  type = lib.types.str;
                  default = "";
                  description = "URL to OpenID issuer.";
                  example = "https://authentik.parawell.cloud/application/o/test-headscale/";
                };

                client_id = lib.mkOption {
                  type = lib.types.str;
                  default = "";
                  description = "The client ID for the OIDC client.";
                  example = "your-client-id";
                };

                client_secret = lib.mkOption {
                  type = lib.types.nullOr lib.types.str;
                  default = null;
                  description = ''
                    The client secret for the OIDC client.
                  '';
                  example = "config.sops.secrets.oidc_secret.path";
                };

                client_secret_path = lib.mkOption {
                  type = lib.types.nullOr lib.types.path;
                  default = null;
                  description = ''
                    Path to a file containing the OIDC client secret.
                    Can be used instead of client_secret.
                  '';
                  example = "config.sops.secrets.oidc_client_secret.path";
                };

                disable_api_key_login = lib.mkOption {
                  type = lib.types.bool;
                  default = false;
                  description = "Whether to disable API key login.";
                };

                token_endpoint_auth_method = lib.mkOption {
                  type = lib.types.enum [
                    "client_secret_post"
                    "client_secret_basic"
                  ];
                  default = "client_secret_post";
                  description = "The token endpoint authentication method.";
                };

                headscale_api_key = lib.mkOption {
                  type = lib.types.nullOr lib.types.str;
                  default = null;
                  description = ''
                    If you are using OIDC, you need to generate an API key
                    that can be used to authenticate other sessions when signing in.
                    This can be done with `headscale apikeys create --expiration 999d`.
                  '';
                  example = "config.sops.secrets.headscale_api_key.path";
                };

                headscale_api_key_path = lib.mkOption {
                  type = lib.types.nullOr lib.types.path;
                  default = null;
                  description = ''
                    Path to a file containing the Headscale API key.
                    Can be used instead of headscale_api_key.
                  '';
                  example = "config.sops.secrets.headscale_api_key.path";
                };

                redirect_uri = lib.mkOption {
                  type = lib.types.str;
                  description = ''
                    This should point to your publicly accessible URL
                    for your Headplane instance with /admin/oidc/callback.
                  '';
                  example = "https://headscale.example.com/admin/oidc/callback";
                };
              };
            };
            default = {};
            description = "OIDC Configuration for authentication.";
          };
        };
      };
      default = {};
    };

    agent = mkOption {
      type = types.submodule {
        options = {
          enable = mkEnableOption "headplane-agent";
          package = mkPackageOption pkgs "headplane-agent" {};
          settings = mkOption {
            type = types.attrsOf [types.str types.bool];
            description = "Headplane agent env vars config. See: https://github.com/tale/headplane/blob/main/docs/Headplane-Agent.md";
            default = {};
          };
        };
      };
    };
  };

  config = mkIf cfg.enable {
    environment = {
      systemPackages = [cfg.package];
      etc."headplane/config.yaml".source = "${settingsFile}";
    };

    systemd.services.headplane-agent =
      mkIf cfg.agent.enable
      {
        description = "Headplane side-running agent";

        wantedBy = ["multi-user.target"];
        after = ["headplane.service"];
        requires = ["headplane.service"];

        environment = agentEnv;

        serviceConfig = {
          User = config.services.headscale.user;
          Group = config.services.headscale.group;

          ExecStart = "${pkgs.headplane-agent}/bin/hp_agent";
          Restart = "always";
          RestartSec = 5;

          # TODO: Harden `systemd` security according to the "The Principle of Least Power".
          # See: `$ systemd-analyze security headplane-agent`.
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
