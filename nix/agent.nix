{buildGoModule}:
buildGoModule {
  pname = "hp_agent";
  version = (builtins.fromJSON (builtins.readFile ../package.json)).version;
  src = ../.;
  vendorHash = "sha256-3hZzDORAH+D4FW6SkOv3Enddd+q36ZALryvCPD9E5Ac=";
  ldflags = ["-s" "-w"];
  env.CGO_ENABLED = 0;
}
