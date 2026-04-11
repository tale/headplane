{
  git,
  headplane-ssh-wasm,
  lib,
  makeWrapper,
  nodejs_24,
  pnpm_10,
  fetchPnpmDeps,
  pnpmConfigHook,
  stdenv,
}: let
  pkg = builtins.fromJSON (builtins.readFile ../package.json);
  pname = pkg.name;
  version = pkg.version;
  src = ../.;
in
  stdenv.mkDerivation (finalAttrs: {
    pname = pname;
    version = version;
    src = src;

    nativeBuildInputs = [
      makeWrapper
      nodejs_24
      pnpm_10
      pnpmConfigHook
      git
    ];

    dontCheckForBrokenSymlinks = true;

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
		fetcherVersion = 3;
		pnpm = pnpm_10;
		hash = "sha256-tbv+n3lWLjv0mZDdAXYM2R8dYE2n950/tluDaVUNiuk=";
  };

    buildPhase = ''
      runHook preBuild
      cp ${headplane-ssh-wasm}/hp_ssh.wasm app/hp_ssh.wasm
      cp ${headplane-ssh-wasm}/wasm_exec.js app/wasm_exec.js
      pnpm react-router build
      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall
      mkdir -p $out/{bin,share/headplane}
      cp -r build $out/share/headplane/
      cp -r drizzle $out/share/headplane/
      sed -i "s;$PWD;../..;" $out/share/headplane/build/server/index.js
      makeWrapper ${lib.getExe nodejs_24} $out/bin/headplane \
        --chdir $out/share/headplane \
        --add-flags $out/share/headplane/build/server/index.js
      runHook postInstall
    '';
  })
