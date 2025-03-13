{buildGoModule}:
buildGoModule {
  pname = "hp_agent";
  version = (builtins.fromJSON (builtins.readFile ../package.json)).version;
  src = ../.;
  vendorHash = "sha256-G0kahv3mPTL/mxU2U+0IytJaFVPXMbMBktbLMfM0BO8=";
  ldflags = ["-s" "-w"];
  env.CGO_ENABLED = 0;
}
