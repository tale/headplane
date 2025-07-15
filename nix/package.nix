{
  git,
  lib,
  makeWrapper,
  nodejs_22,
  pnpm_10,
  stdenv,
  go,
  ...
}:
let
  wasmExecJs =
    if builtins.pathExists "${go}/share/go/lib/wasm/wasm_exec.js"
    then "${go}/share/go/lib/wasm/wasm_exec.js"
    else if builtins.pathExists "${go}/lib/wasm/wasm_exec.js"
    then "${go}/lib/wasm/wasm_exec.js"
    else "${go}/share/go/misc/wasm/wasm_exec.js";
in
stdenv.mkDerivation (finalAttrs: {
  pname = "headplane";
  version = (builtins.fromJSON (builtins.readFile ../package.json)).version;
  src = ../.;

  nativeBuildInputs = [
    makeWrapper
    nodejs_22
    pnpm_10.configHook
    git
    go
  ];

  dontCheckForBrokenSymlinks = true;

  pnpmDeps = pnpm_10.fetchDeps {
    inherit (finalAttrs) pname version src;
    hash = "sha256-GNSpFqPobX6MDPUXxz2XwdZ2Wt7boN8aok52pGgpGoM=";
  };

  buildPhase = ''
    runHook preBuild

    # Build the Go WASM binary
    export GOOS=js
    export GOARCH=wasm
    go build -o app/hp_ssh.wasm ./cmd/hp_ssh

    # Copy wasm_exec.js to the app directory (from Nix store)
    cp ${wasmExecJs} app/wasm_exec.js

    pnpm build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/{bin,share/headplane}
    cp -r build $out/share/headplane/
    sed -i "s;$PWD;../..;" $out/share/headplane/build/server/index.js
    makeWrapper ${lib.getExe nodejs_22} $out/bin/headplane \
        --chdir $out/share/headplane \
        --add-flags $out/share/headplane/build/server/index.js
    runHook postInstall
  '';
})
