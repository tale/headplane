{buildGoModule}:
buildGoModule {
  pname = "hp_agent";
  version = (builtins.fromJSON (builtins.readFile ../package.json)).version;
  src = ../.;
  vendorHash = "sha256-Unjq1QCckuY+xO4HLaNfMJbsjSSv9WYAYeb5OqOR/P0=";
  ldflags = ["-s" "-w"];
  env.CGO_ENABLED = 0;
}
