#!/bin/sh
# Run only in an explicitly prepared disposable systemd VM, as root.
# Args: baseline.deb upgrade.deb node24.deb; Headscale must already be running.
set -eu

[ "$(id -u)" = 0 ]
[ -f /etc/headplane-package-test-vm ] || {
    echo "Refusing to modify a system without /etc/headplane-package-test-vm" >&2
    exit 1
}
[ "$#" = 3 ] || { echo "Usage: $0 baseline.deb upgrade.deb node24.deb" >&2; exit 1; }
BASE=$(realpath "$1")
UPGRADE=$(realpath "$2")
NODE=$(realpath "$3")
TEST_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
export DEBIAN_FRONTEND=noninteractive

inactive() { ! systemctl is-active --quiet headplane; }
healthy() {
    count=0
    until curl -fsS http://127.0.0.1:3000/admin/healthz >/dev/null 2>&1; do
        count=$((count + 1))
        [ "$count" -lt 60 ] || { journalctl -u headplane --no-pager -n 40; exit 1; }
        sleep 1
    done
}
pid() { systemctl show headplane -p MainPID --value; }
preserved() {
    sha256sum -c /tmp/headplane-config.sha256
    test "$(stat -c '%U:%G:%a' /etc/headplane/config.yaml)" = root:headplane:640
    test "$(cat /var/lib/headplane/package-test-marker)" = retained
    test "$(id -u headplane)" = "$SERVICE_UID"
}

# Ask APT to resolve explicitly incompatible runtimes. These metadata-only
# fixtures are never installed and also work when CI already has Node.js 24.
FIXTURE=$(mktemp -d)
trap 'rm -rf "$FIXTURE"' EXIT HUP INT TERM
mkdir -p "$FIXTURE/package/DEBIAN"
for version in 20.0.0 25.0.0; do
    cat >"$FIXTURE/package/DEBIAN/control" <<EOF
Package: nodejs
Version: $version
Architecture: $(dpkg --print-architecture)
Maintainer: Package tests <noreply@localhost>
Description: Dependency resolver fixture; never install
EOF
    dpkg-deb --build "$FIXTURE/package" "$FIXTURE/nodejs.deb" >/dev/null
    if apt-get -s install "$BASE" "$FIXTURE/nodejs.deb" >"/tmp/headplane-node-$version.log" 2>&1; then
        echo "Package incorrectly accepted Node.js $version" >&2
        exit 1
    fi
    grep -q nodejs "/tmp/headplane-node-$version.log"
done
apt-get install -y "$NODE"
apt-get install -y "$BASE"
inactive
test "$(systemctl is-enabled headplane || true)" = disabled
test ! -e /etc/headplane/config.yaml
test -x /usr/libexec/headplane/agent
test -x /usr/libexec/headplane/healthcheck
test -s /usr/lib/headplane/build/client/hp_ssh.wasm
test ! -d /usr/lib/headplane/node_modules
systemctl start headplane
inactive

cat >/etc/headplane/config.yaml <<'EOF'
server:
  host: "127.0.0.1"
  port: 3000
  base_url: "http://127.0.0.1:3000"
  cookie_secret: "0123456789abcdef0123456789abcdef"
  cookie_secure: false
  data_path: "/var/lib/headplane"
headscale:
  url: "http://127.0.0.1:8080"
EOF
chown root:headplane /etc/headplane/config.yaml
chmod 0640 /etc/headplane/config.yaml
SERVICE_UID=$(id -u headplane)
sha256sum /etc/headplane/config.yaml >/tmp/headplane-config.sha256
echo retained >/var/lib/headplane/package-test-marker
systemctl enable --now headplane
healthy
test "$(stat -c %u /proc/"$(pid)")" = "$SERVICE_UID"
python3 "$TEST_DIR/http-smoke.py"

OLD_PID=$(pid)
apt-get install -y "$UPGRADE"
healthy
test "$(pid)" != "$OLD_PID"
test "$(systemctl is-enabled headplane)" = enabled
preserved
python3 "$TEST_DIR/http-smoke.py"

# A stopped and disabled service must stay that way across a reinstall.
systemctl disable --now headplane
apt-get install -y --reinstall "$UPGRADE"
inactive
test "$(systemctl is-enabled headplane || true)" = disabled
preserved

# A manually started service still needs new code even when it is disabled.
systemctl start headplane
healthy
OLD_PID=$(pid)
apt-get install -y --reinstall "$UPGRADE"
healthy
test "$(pid)" != "$OLD_PID"
test "$(systemctl is-enabled headplane || true)" = disabled
systemctl stop headplane

# Administrator masks must survive package configuration.
systemctl mask headplane
apt-get install -y --reinstall "$UPGRADE"
test "$(systemctl is-enabled headplane || true)" = masked
inactive
systemctl unmask headplane

systemctl enable --now headplane
healthy
apt-get remove -y headplane
inactive
test ! -e /usr/lib/headplane/build/server/index.js
preserved
apt-get install -y "$UPGRADE"
inactive
preserved
systemctl start headplane
healthy
apt-get purge -y headplane
inactive
preserved
test ! -e /usr/lib/systemd/system/headplane.service
echo 'PASS: runtime rejection, install, systemd, upgrade, stopped/masked reinstall, remove, reinstall, purge, retained config/state/UID'
