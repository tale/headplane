{buildGoModule}:
buildGoModule {
  pname = "hp_agent";
  version = (builtins.fromJSON (builtins.readFile ../package.json)).version;
  src = ../.;
  vendorHash = "sha256-Q5lRDbx7bg3WsrF+ukVPl7rTSJcqKFhYM9lWtqfiIw4=";
  ldflags = ["-s" "-w"];
  env.CGO_ENABLED = 0;
}
