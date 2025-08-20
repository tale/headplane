{buildGoModule}:
buildGoModule {
  pname = "hp_agent";
  version = (builtins.fromJSON (builtins.readFile ../package.json)).version;
  src = ../.;
  vendorHash = "sha256-cPE8cnfTdzi6hAmSXujKmfd5ezivc3sQ6DKOZubCpYI=";
  ldflags = ["-s" "-w"];
  env.CGO_ENABLED = 0;
}
