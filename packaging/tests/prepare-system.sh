#!/bin/sh
# Prepare a disposable VM/hosted CI runner for lifecycle.sh. Never use on a
# production host: this installs a test Headscale and downloads a test runtime.
set -eu
[ "$(id -u)" = 0 ]
[ -f /etc/headplane-package-test-vm ] || exit 1
TEST_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
DEST=${1:?Supply a directory for downloaded test dependencies}
mkdir -p "$DEST"
DEST=$(CDPATH='' cd -- "$DEST" && pwd)
ARCH=$(dpkg --print-architecture)
case "$ARCH" in
    amd64)
        NODE_SHA=6f091c83324fefd8f7dd9d358b77131b679c04aa6f5859244749f3a6c60ea56a
        HS_SHA=8dc183758024ed7095cf610fedea0790233613c71353bc8be2715d82ba29b92c
        ;;
    arm64)
        NODE_SHA=cf4a20619af397041b187eff05ddceebe88cd6568f4f53eb04d55e24e1c15891
        HS_SHA=ecf0099f9aa1efb56e7c74718342a493f7d44a840626a2877ca526e675040f4e
        ;;
    *) exit 1 ;;
esac
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl python3
NODE="nodejs_24.21.0-1nodesource1_${ARCH}.deb"
curl --fail --location --retry 3 \
    "https://deb.nodesource.com/node_24.x/pool/main/n/nodejs/$NODE" -o "$DEST/$NODE"
curl --fail --location --retry 3 \
    "https://github.com/juanfont/headscale/releases/download/v0.29.3/headscale_0.29.3_linux_$ARCH" \
    -o "$DEST/headscale"
printf '%s  %s\n' "$NODE_SHA" "$DEST/$NODE" "$HS_SHA" "$DEST/headscale" | sha256sum -c -
install -m 0755 "$DEST/headscale" /usr/local/bin/headscale
install -d /etc/headscale /var/lib/headscale /var/run/headscale
install -m 0644 "$TEST_DIR/headscale.yaml" /etc/headscale/config.yaml
cat >/etc/systemd/system/headscale.service <<'EOF'
[Unit]
Description=Disposable Headscale test instance
After=network.target
[Service]
ExecStart=/usr/local/bin/headscale serve
Restart=on-failure
EOF
systemctl daemon-reload
systemctl start headscale
count=0
until curl -fsS http://127.0.0.1:8080/health >/dev/null 2>&1; do
    count=$((count + 1))
    [ "$count" -lt 60 ] || { journalctl -u headscale --no-pager -n 40; exit 1; }
    sleep 1
done
