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
		hash = "sha256-2F7DplZ+PAMkDepsoeUxS04+IefWy3ARgE8G6Fz+YnQ=";
  };

    buildPhase = ''
      runHook preBuild
      cp ${headplane-ssh-wasm}/hp_ssh.wasm public/hp_ssh.wasm
      cp ${headplane-ssh-wasm}/wasm_exec.js public/wasm_exec.js
      pnpm build
      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall
      mkdir -p $out/{bin,share/headplane}
      cp -r build $out/share/headplane/
      cp -r drizzle $out/share/headplane/
      makeWrapper ${lib.getExe nodejs_24} $out/bin/headplane \
        --chdir $out/share/headplane \
        --add-flags $out/share/headplane/build/server/index.js
      runHook postInstall
    '';
  })
