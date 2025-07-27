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
    mkEnableOption
    mkIf
    mkPackageOption
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
  settingsFile = settingsFormat.generate "headplane-config.yaml" settingsWithoutNulls;
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
        options = {
          server = lib.mkOption {
            type = lib.types.submodule {
              options = {
                host = lib.mkOption {
                  type = lib.types.str;
                  default = "127.0.0.1";
                  description = "The host address to bind to.";
                  example = "0.0.0.0";
                };

                port = lib.mkOption {
                  type = lib.types.port;
                  default = 3000;
                  description = "The port to listen on.";
                };

                cookie_secret_path = lib.mkOption {
                  type = lib.types.nullOr lib.types.path;
                  default = null;
                  description = ''
                    Path to a file containing the cookie secret.
                    The secret must be exactly 32 characters long.
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

                data_path = lib.mkOption {
                  type = lib.types.path;
                  default = "/var/lib/headplane";
                  description = ''
                    The path to persist Headplane specific data.
                    All data going forward is stored in this directory, including the internal database and any cache related files.
                    Data formats prior to 0.6.1 will automatically be migrated.
                  '';
                  example = "/var/lib/headplane";
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

                tls_cert_path = lib.mkOption {
                  type = lib.types.nullOr lib.types.path;
                  default = null;
                  description = ''
                    Path to a file containing the TLS certificate.
                  '';
                  example = "config.sops.secrets.tls_cert.path";
                };

                public_url = lib.mkOption {
                  type = lib.types.nullOr lib.types.str;
                  default = null;
                  description = "Public URL if differrent. This affects certain parts of the web UI.";
                  example = "https://headscale.example.com";
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

                dns_records_path = lib.mkOption {
                  type = lib.types.nullOr lib.types.path;
                  default = null;
                  description = ''
                    If you are using `dns.extra_records_path` in your Headscale configuration, you need to set this to the path for Headplane to be able to read the DNS records.
                    Ensure that the file is both readable and writable by the Headplane process.
                    When using this, Headplane will no longer need to automatically restart Headscale for DNS record changes.
                  '';
                  example = "/var/lib/headplane/extra_records.json";
                };
              };
            };
            default = {};
            description = "Headscale specific settings for Headplane integration.";
          };

          integration = lib.mkOption {
            type = lib.types.submodule {
              options = {
                agent = lib.mkOption {
                  type = lib.types.submodule {
                    options = {
                      enabled = lib.mkOption {
                        type = lib.types.bool;
                        default = false;
                        description = ''
                          The Headplane agent allows retrieving information about nodes.
                          This allows the UI to display version, OS, and connectivity data.
                          You will see the Headplane agent in your Tailnet as a node when it connects.
                        '';
                      };

                      pre_authkey_path = lib.mkOption {
                        type = lib.types.nullOr lib.types.path;
                        default = null;
                        description = ''
                          Path to a file containing the agent preauth key.
                          To connect to your Tailnet, you need to generate a pre-auth key.
                          This can be done via the web UI or through the `headscale` CLI.
                        '';
                        example = "config.sops.secrets.agent_pre_authkey.path";
                      };

                      host_name = lib.mkOption {
                        type = lib.types.str;
                        default = "headplane-agent";
                        description = "Optionally change the name of the agent in the Tailnet";
                      };

                      cache_ttl = lib.mkOption {
                        type = lib.types.int;
                        default = 180000;
                        description = ''
                          How long to cache agent information (in milliseconds).
                          If you want data to update faster, reduce the TTL, but this will increase the frequency of requests to Headscale.
                        '';
                      };

                      cache_path = lib.mkOption {
                        type = lib.types.path;
                        default = "/var/lib/headplane/agent_cache.json";
                        description = "Where to store the agent cache.";
                      };

                      work_dir = lib.mkOption {
                        type = lib.types.path;
                        default = "/var/lib/headplane/agent";
                        description = ''
                          Do not change this unless you are running a custom deployment.
                          The work_dir represents where the agent will store its data to be able to automatically reauthenticate with your Tailnet.
                          It needs to be writable by the user running the Headplane process.
                        '';
                      };

                      package = mkPackageOption pkgs "headplane-agent" {};
                    };
                  };
                  default = {};
                  description = "Agent configuration for the Headplane agent.";
                };

                proc = lib.mkOption {
                  type = lib.types.submodule {
                    options = {
                      enabled = lib.mkOption {
                        type = lib.types.bool;
                        default = true;
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
                  example = "https://provider.example.com/issuer-url";
                };

                client_id = lib.mkOption {
                  type = lib.types.str;
                  default = "";
                  description = "The client ID for the OIDC client.";
                  example = "your-client-id";
                };

                client_secret_path = lib.mkOption {
                  type = lib.types.nullOr lib.types.path;
                  default = null;
                  description = ''
                    Path to a file containing the OIDC client secret.
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
                    "client_secret_jwt"
                  ];
                  default = "client_secret_post";
                  description = "The token endpoint authentication method.";
                };

                headscale_api_key_path = lib.mkOption {
                  type = lib.types.nullOr lib.types.path;
                  default = null;
                  description = ''
                    Path to a file containing the Headscale API key.
                  '';
                  example = "config.sops.secrets.headscale_api_key.path";
                };

                redirect_uri = lib.mkOption {
                  type = lib.types.str;
                  default = "";
                  description = ''
                    This should point to your publicly accessible URL
                    for your Headplane instance with /admin/oidc/callback.
                  '';
                  example = "https://headscale.example.com/admin/oidc/callback";
                };

                user_storage_file = lib.mkOption {
                  type = lib.types.path;
                  default = "/var/lib/headplane/users.json";
                  description = ''
                    Path to a file containing the users and their permissions for Headplane.
                  '';
                  example = "/var/lib/headplane/users.json";
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
  };

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

      serviceConfig = {
        User = config.services.headscale.user;
        Group = config.services.headscale.group;
        StateDirectory = "headplane";

        ExecStart = "${pkgs.headplane}/bin/headplane";
        Restart = "always";
        RestartSec = 5;

        # TODO: Harden `systemd` security according to the "The Principle of Least Power".
        # See: `$ systemd-analyze security headplane`.
      };
    };
  };
}
