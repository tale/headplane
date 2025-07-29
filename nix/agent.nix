{buildGoModule}:
buildGoModule {
  pname = "hp_agent";
  version = (builtins.fromJSON (builtins.readFile ../package.json)).version;
  src = ../.;
  vendorHash = "sha256-5TmX9ZUotNC3ZnNWRlyugAmzQG/WSZ66jFfGljql/ww=";
  ldflags = ["-s" "-w"];
  env.CGO_ENABLED = 0;
}
