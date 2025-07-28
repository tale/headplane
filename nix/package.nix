{
  git,
  headplane-ssh-wasm,
  lib,
  makeWrapper,
  nodejs_22,
  pnpm_10,
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
      nodejs_22
      pnpm_10.configHook
      git
    ];

    dontCheckForBrokenSymlinks = true;

    pnpmDeps = pnpm_10.fetchDeps {
      inherit pname version src;
      fetcherVersion = 2;
      hash = "sha256-GNSpFqPobX6MDPUXxz2XwdZ2Wt7boN8aok52pGgpGoM=";
    };

    buildPhase = ''
      runHook preBuild
      cp ${headplane-ssh-wasm}/hp_ssh.wasm app/hp_ssh.wasm
      cp ${headplane-ssh-wasm}/wasm_exec.js app/wasm_exec.js
      pnpm build
      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall
      mkdir -p $out/{bin,share/headplane}
      cp -r build $out/share/headplane/
      cp -r node_modules $out/share/headplane/
      cp -r drizzle $out/share/headplane/
      sed -i "s;$PWD;../..;" $out/share/headplane/build/server/index.js
      makeWrapper ${lib.getExe nodejs_22} $out/bin/headplane \
        --chdir $out/share/headplane \
        --add-flags $out/share/headplane/build/server/index.js
      runHook postInstall
    '';
  })
