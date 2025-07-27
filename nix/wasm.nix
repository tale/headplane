{
  buildGoModule,
  go,
  lib,
  ...
}: let
  pkg = builtins.fromJSON (builtins.readFile ../package.json);
  pname = "hp_ssh-wasm";
  version = pkg.version;
  wasmExecJs =
    if builtins.pathExists "${go}/share/go/lib/wasm/wasm_exec.js"
    then "${go}/share/go/lib/wasm/wasm_exec.js"
    else if builtins.pathExists "${go}/lib/wasm/wasm_exec.js"
    then "${go}/lib/wasm/wasm_exec.js"
    else "${go}/share/go/misc/wasm/wasm_exec.js";
in
  buildGoModule rec {
    inherit pname version;
    src = ../.;
    subPackages = ["cmd/hp_ssh"];
    vendorHash = "sha256-3hZzDORAH+D4FW6SkOv3Enddd+q36ZALryvCPD9E5Ac=";
    env.CGO_ENABLED = 0;

    nativeBuildInputs = [go];

    buildPhase = ''
      export GOOS=js
      export GOARCH=wasm
      go build -o hp_ssh.wasm ./cmd/hp_ssh
    '';

    installPhase = ''
      mkdir -p $out
      cp hp_ssh.wasm $out/
      cp ${wasmExecJs} $out/wasm_exec.js
    '';
  }
