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
    vendorHash = "sha256-cPE8cnfTdzi6hAmSXujKmfd5ezivc3sQ6DKOZubCpYI=";
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
