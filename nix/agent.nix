{buildGoModule}:
buildGoModule {
  pname = "hp_agent";
  version = (builtins.fromJSON (builtins.readFile ../package.json)).version;
  src = ../.;
  vendorHash = "sha256-M7F4I+GjcHMdIp3KsvftN6SppFYMf4jW0DgiPKbFUCg=";
  ldflags = ["-s" "-w"];
  env.CGO_ENABLED = 0;
}
