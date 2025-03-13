{
  git,
  lib,
  makeWrapper,
  nodejs_22,
  pnpm_10,
  stdenv,
  ...
}:
stdenv.mkDerivation (finalAttrs: {
  pname = "headplane";
  version = (builtins.fromJSON (builtins.readFile ../package.json)).version;
  src = ../.;

  nativeBuildInputs = [
    makeWrapper
    nodejs_22
    pnpm_10.configHook
    git
  ];

  dontCheckForBrokenSymlinks = true;

  pnpmDeps = pnpm_10.fetchDeps {
    inherit (finalAttrs) pname version src;
    hash = "sha256-j+3fcxukK19fXVIlVe+tXenYf28MylHy+/qHy7FpvL0=";
  };

  buildPhase = ''
    runHook preBuild
    pnpm build
    pnpm prune --prod
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/{bin,share/headplane}
    cp -r {build,node_modules} $out/share/headplane/
    sed -i "s;$PWD;../..;" $out/share/headplane/build/headplane/server.js
    makeWrapper ${lib.getExe nodejs_22} $out/bin/headplane \
        --chdir $out/share/headplane \
        --set BUILD_PATH $out/share/headplane/build \
        --set NODE_ENV production \
        --add-flags $out/share/headplane/build/headplane/server.js
    runHook postInstall
  '';
})
