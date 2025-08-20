{buildGoModule}:
buildGoModule {
  pname = "hp_agent";
  version = (builtins.fromJSON (builtins.readFile ../package.json)).version;
  src = ../.;
  vendorHash = "sha256-AyJx1os4auTmHvz+KLY+RGyysa3LWi8r2+QLxofPUH4=";
  ldflags = ["-s" "-w"];
  env.CGO_ENABLED = 0;
}
