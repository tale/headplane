{
  buildGoModule,
  go,
}: let
  wasmExecJs =
    if builtins.pathExists "${go}/share/go/lib/wasm/wasm_exec.js"
    then "${go}/share/go/lib/wasm/wasm_exec.js"
    else if builtins.pathExists "${go}/lib/wasm/wasm_exec.js"
    then "${go}/lib/wasm/wasm_exec.js"
    else "${go}/share/go/misc/wasm/wasm_exec.js";
in
  buildGoModule {
    pname = "headplane-ssh-wasm";
    version = (builtins.fromJSON (builtins.readFile ../package.json)).version;
    src = ../.;
    subPackages = ["cmd/hp_ssh"];
    vendorHash = "sha256-Q5lRDbx7bg3WsrF+ukVPl7rTSJcqKFhYM9lWtqfiIw4=";
    env.CGO_ENABLED = 0;

    nativeBuildInputs = [go];

    buildPhase = ''
      export GOOS=js
      export GOARCH=wasm

      # Tailscale's netcheck builds its browser DERP probe URL from the
      # hostname alone, so a DERP server on a non-443 port never gets a
      # home relay.
      chmod -R +w vendor/tailscale.com
      patch -d vendor/tailscale.com -p1 < patches/tailscale-netcheck-derp-port.patch

      go build -mod=vendor -tags "$(cat cmd/hp_ssh/build-tags.txt)" \
        -trimpath -ldflags "-s -w" -o hp_ssh.wasm ./cmd/hp_ssh
    '';

    installPhase = ''
      mkdir -p $out
      cp hp_ssh.wasm $out/
      cp ${wasmExecJs} $out/wasm_exec.js
    '';
  }
