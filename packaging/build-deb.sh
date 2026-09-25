#!/bin/sh
# Build a Release binary package from this checkout or an explicit source tree.
set -eu

PACKAGING_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
SOURCE_DIR=$(CDPATH='' cd -- "${SOURCE_DIR:-$PACKAGING_DIR/..}" && pwd)
OUTPUT_DIR=${OUTPUT_DIR:-$SOURCE_DIR/dist}
DEB_ARCH=${DEB_ARCH:-$(dpkg --print-architecture)}
SKIP_BUILD=${SKIP_BUILD:-0}
export SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-$(git -C "$SOURCE_DIR" log -1 --format=%ct)}"

case "$DEB_ARCH" in
    amd64|arm64) ;;
    *) echo "Unsupported architecture: $DEB_ARCH" >&2; exit 1 ;;
esac
for tool in node pnpm go python3 dh dpkg-buildpackage readelf; do
    command -v "$tool" >/dev/null || { echo "Missing build tool: $tool" >&2; exit 1; }
done
if [ "$DEB_ARCH" != "$(dpkg --print-architecture)" ]; then
    TRIPLET=$(dpkg-architecture -a"$DEB_ARCH" -qDEB_HOST_GNU_TYPE)
    command -v "$TRIPLET-strip" >/dev/null || {
        echo "Cross-packaging requires binutils-$TRIPLET" >&2; exit 1;
    }
fi

cd "$SOURCE_DIR"
# Fail closed when upstream changes its runtime range: update Debian metadata
# and validate the new runtime before producing another package.
node --input-type=module -e '
import fs from "node:fs";
const p = JSON.parse(fs.readFileSync("package.json"));
if (p.engines.node !== ">=24.2 <25" || process.versions.node.split(".")[0] !== "24" ||
    Number(process.versions.node.split(".")[1]) < 2) {
  throw new Error("Debian packaging requires the reviewed Node.js >=24.2 <25 range");
}
'
APP_VERSION=$(node -p 'JSON.parse(require("fs").readFileSync("package.json")).version')
TAG=$(git describe --tags --exact-match 2>/dev/null || true)
SOURCE_VERSION=$APP_VERSION
if [ "${TAG#v}" != "$APP_VERSION" ] || ! git diff --quiet HEAD; then
    SOURCE_VERSION="$APP_VERSION+git$(git rev-parse --short=7 HEAD)"
fi
DEB_VERSION=${DEB_VERSION:-$(printf '%s' "$SOURCE_VERSION" | sed 's/-/~/')-1}
dpkg --validate-version "$DEB_VERSION"

if [ "$SKIP_BUILD" = 0 ]; then
    export GOOS=linux GOARCH="$DEB_ARCH" CGO_ENABLED=0
    export HEADPLANE_VERSION="${HEADPLANE_VERSION:-$SOURCE_VERSION}"
    # Retain build dependencies for license collection and subsequent checks.
    ./build.sh --skip-pnpm-prune
fi

for file in build/server/index.js build/client/hp_ssh.wasm build/client/wasm_exec.js build/hp_agent build/hp_healthcheck; do
    [ -s "$file" ] || { echo "Missing build artifact: $file" >&2; exit 1; }
done
for file in build/hp_agent build/hp_healthcheck; do
    case "$DEB_ARCH" in
        amd64) readelf -h "$file" | grep -q 'Advanced Micro Devices X86-64' ;;
        arm64) readelf -h "$file" | grep -q 'AArch64' ;;
    esac
    if readelf -l "$file" | grep -q INTERP; then
        echo "Expected a static Go binary: $file (build with CGO_ENABLED=0)" >&2
        exit 1
    fi
done

mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR=$(CDPATH='' cd -- "$OUTPUT_DIR" && pwd)
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT HUP INT TERM
mkdir -p "$STAGE/source/debian" "$STAGE/source/payload/usr/lib/headplane/build" \
    "$STAGE/source/payload/usr/libexec/headplane" "$STAGE/source/payload/usr/share/doc/headplane/examples"
cp -a "$PACKAGING_DIR/debian/." "$STAGE/source/debian/"
APP="$STAGE/source/payload/usr/lib/headplane"
DOC="$STAGE/source/payload/usr/share/doc/headplane"
cp -a build/server build/client "$APP/build/"
cp -a drizzle "$APP/"
# Vite bundles the production dependencies; package.json keeps explicit ESM
# semantics without requiring npm or pnpm on the installed system.
printf '{"type":"module"}\n' > "$APP/package.json"
install -m 0755 build/hp_agent "$STAGE/source/payload/usr/libexec/headplane/agent"
install -m 0755 build/hp_healthcheck "$STAGE/source/payload/usr/libexec/headplane/healthcheck"
install -m 0644 config.example.yaml "$DOC/examples/config.yaml"
install -m 0644 LICENSE "$DOC/copyright"
install -m 0644 "$PACKAGING_DIR/README.md" "$DOC/README.Debian"
python3 "$PACKAGING_DIR/collect-licenses.py" "$SOURCE_DIR" "$DOC/licenses"
{
    printf 'Source: %s\n' "$(git rev-parse HEAD)"
    printf 'Package: %s\nArchitecture: %s\n' "$DEB_VERSION" "$DEB_ARCH"
    node --version
    pnpm --version
    go version
} > "$DOC/build-info"
cat > "$STAGE/source/debian/changelog" <<EOF
headplane ($DEB_VERSION) unstable; urgency=medium

  * Package the Headplane $APP_VERSION build for native installation.

 -- Headplane packaging contributors <noreply@localhost>  $(LC_ALL=C date -u -d "@$SOURCE_DATE_EPOCH" -R)
EOF
chmod 0755 "$STAGE/source/debian/rules" "$STAGE/source/debian/"headplane.post* "$STAGE/source/debian/headplane.prerm"
cd "$STAGE/source"
dpkg-buildpackage --build=binary --no-sign --host-arch="$DEB_ARCH" -d
PACKAGE="headplane_${DEB_VERSION}_linux_${DEB_ARCH}.deb"
cp "$STAGE/headplane_${DEB_VERSION}_${DEB_ARCH}.deb" "$OUTPUT_DIR/$PACKAGE"
cd "$OUTPUT_DIR"
sha256sum "$PACKAGE" > "$PACKAGE.sha256"
printf '\nPackage: %s/%s\n' "$OUTPUT_DIR" "$PACKAGE"
