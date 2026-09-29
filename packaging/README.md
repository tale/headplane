# Debian binary packages

This packaging prototype builds a local `.deb` with prebuilt web, Agent and
Browser SSH assets. It does not configure an APT repository. The release
workflow integration remains a proposal until accepted by the maintainers.

## Build

Use Linux with the Node.js and pnpm versions declared in `package.json`, the
Go version from `go.mod`, and Debian build tools:

```sh
sudo apt install debhelper dpkg-dev binutils python3 patch
./packaging/build-deb.sh
```

The script calls `build.sh`, uses the lockfiles and writes a `.deb` and its
SHA-256 checksum to `dist/`. Run on the target architecture by default. Advanced
builds may set `SOURCE_DIR`, `OUTPUT_DIR`, `DEB_ARCH`, `DEB_VERSION` and
`HEADPLANE_VERSION`. `SKIP_BUILD=1` packages an already completed build; use it
only after building the selected source with `CGO_ENABLED=0`. Architecture and
required artifacts are checked before packaging. Both amd64 and arm64 metadata
are supported; validate each target before publishing it.

Cross-packaging also requires the target binutils package (for example,
`binutils-aarch64-linux-gnu` when building arm64 on amd64). Development
checkouts receive a `+git<commit>` package version so they are distinguishable
from tagged releases.

For example, package a stable checkout without changing the working branch:

```sh
SOURCE_DIR=/path/to/headplane-v0.7.1 \
  OUTPUT_DIR="$PWD/dist" ./packaging/build-deb.sh
```

This is a GitHub Release binary-package workflow, not a Debian archive source
package. Build-time downloads follow the existing Go and pnpm lockfiles. The
installed package needs neither Go nor pnpm and performs no network downloads
or compilation in its maintainer scripts. Production JavaScript dependencies
are bundled by Vite; dependency notices and build provenance are included
under `/usr/share/doc/headplane/`.

## Install and configure

Install a **dpkg-managed Node.js version `>=24.2` and `<25`** first. A Node.js
binary installed with nvm or extracted into `/usr/local` does not satisfy the
package dependency. Debian 13's default Node.js 20 is insufficient. Choose
and configure a suitable runtime source yourself; this package does not add
third-party sources. Keep that runtime updated within the supported major.

```sh
sha256sum -c headplane_0.7.1-1_linux_amd64.deb.sha256
sudo apt install ./headplane_0.7.1-1_linux_amd64.deb
sudo install -o root -g headplane -m 0640 \
  /usr/share/doc/headplane/examples/config.yaml /etc/headplane/config.yaml
sudoedit /etc/headplane/config.yaml
sudo systemctl enable --now headplane
```

Before starting, set `server.base_url`, a random 32-character
`server.cookie_secret`, `server.cookie_secure` and `headscale.url`. Keep
`server.data_path: /var/lib/headplane`. Remove `headscale.config_path` for
API-only access unless you have separately granted read access to that file.
Generate a Headscale API key with `headscale apikeys create` and use it to sign
in at `/admin`. For plain HTTP local testing only, set `cookie_secure: false`.

The package creates the `headplane` system account. The service is initially
disabled and stopped, even if a configuration file already exists. It runs as
that account with a read-only system filesystem and writable state directory.
The example configuration is updated with the package; the active configuration
is created and owned by the administrator and is never overwritten by dpkg.

| Path                                        | Purpose                                  |
| ------------------------------------------- | ---------------------------------------- |
| `/usr/lib/headplane/build`                  | Bundled server and static browser assets |
| `/usr/lib/headplane/drizzle`                | Database migrations                      |
| `/usr/libexec/headplane/agent`              | Agent, at the application's default path |
| `/usr/libexec/headplane/healthcheck`        | Optional HTTP healthcheck helper         |
| `/etc/headplane/config.yaml`                | Administrator-created configuration      |
| `/var/lib/headplane`                        | Database, cache and Agent state          |
| `/usr/lib/systemd/system/headplane.service` | Packaged service                         |

For the optional Agent, set `headscale.api_key` and `integration.agent.enabled`;
the packaged executable already matches the default path. Agent and Browser
SSH connectivity require a reachable, compatible Headscale/Tailnet.

Headscale configuration writes and process control require separate permission
design. The package grants neither access to `/etc/headscale` nor permission to
signal Headscale. A writable integration also needs an appropriate
`ReadWritePaths=` systemd override and filesystem permissions. Do not simply
enable `integration.proc` and assume a separate service account can stop
Headscale. See the native-mode integration documentation.

## Upgrade, rollback and removal

Before upgrading, stop Headplane and back up `/etc/headplane` and
`/var/lib/headplane` together, including the SQLite WAL files if present. Start
it again if you want the upgrade to restart the running service automatically.
Install the newer package with the same `apt install ./...deb` command. Running
services are restarted; stopped services stay stopped, and disabled services
remain disabled. Always check `systemctl status headplane` and
`journalctl -u headplane` afterwards.

Database migrations may make state incompatible with older versions. To roll
back, stop the service, install the previous package using
`apt install --allow-downgrades ./previous.deb`, restore the matching configuration
and state backup with its original permissions, and start the service. Merely
installing an older package does not reverse database migrations.

`apt remove headplane` stops the service and removes program files. Both remove
and purge preserve administrator-created configuration, persistent data and the
system account. Purge also removes Debian's service enablement bookkeeping.
Delete retained configuration/state and the account manually only when you no
longer need them. Keep the account while files owned by its UID remain.

## Verification

Validate installation with an incompatible and compatible runtime, systemd
startup, `/admin/login`, static JS/CSS/WASM, authenticated management against
Headscale, active and stopped upgrades, configuration/state preservation,
removal, reinstall, purge and masked services in a disposable systemd VM.
An `apt install` inside an ordinary chroot does not validate service behavior.

The manually triggered `Debian packages` GitHub Actions workflow builds on
native amd64 and arm64 Ubuntu 24.04 runners, runs application checks and the
package lifecycle test, and retains packages with their checksums as workflow
artifacts. It can also be called by a release workflow. Publishing Release
attachments is intentionally a separate integration step for maintainer review.

To reproduce lifecycle tests, prepare a disposable systemd VM and copy two
package versions plus this directory's `tests/` files into it. In that VM only:

```sh
sudo touch /etc/headplane-package-test-vm
sudo sh tests/prepare-system.sh /tmp/headplane-test
sudo sh tests/lifecycle.sh ./baseline.deb ./upgrade.deb \
  /tmp/headplane-test/nodejs_*.deb
```

The preparation script installs a dedicated test Headscale 0.29.3 and downloads
a checksummed Node.js 24.21.0 package. The lifecycle script tests APT's rejection
of Node.js 20 and 25 using resolver-only fixtures, then installs the compatible
runtime and exercises the actual service. The marker file prevents accidental
execution on an unprepared system.
