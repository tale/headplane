{buildGoModule}:
buildGoModule {
  pname = "hp_agent";
  # TODO: take the latest `git tag`, if commits do not match, append `-SNAPSHOT`.
  version = "0.5.3";
  src = ../.;
  vendorHash = "sha256-G0kahv3mPTL/mxU2U+0IytJaFVPXMbMBktbLMfM0BO8=";
  ldflags = ["-s" "-w"];
  env.CGO_ENABLED = 0;
}
