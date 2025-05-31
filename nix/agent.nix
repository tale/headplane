{buildGoModule}:
buildGoModule {
  pname = "hp_agent";
  version = (builtins.fromJSON (builtins.readFile ../package.json)).version;
  src = ../.;
  vendorHash = "sha256-qAB6Q19ymeom7126N7ASaFkcqDBRdbjgmG/OTpcX9sI=";
  ldflags = ["-s" "-w"];
  env.CGO_ENABLED = 0;
}
