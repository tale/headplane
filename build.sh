#!/bin/sh
# This is a general purpose build script for Headplane to be used across many
# different environments such as CI, Docker, Nix, and locally. For specific
# usage instructions, run `./build.sh --help`.

set -eu

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR" || exit 1

APP_DIR="$ROOT_DIR/app"
BUILD_DIR="$ROOT_DIR/build"
PUBLIC_DIR="$ROOT_DIR/public"

BUILD_WASM=0
BUILD_APP=0
BUILD_AGENT=0
BUILD_FAKE_SHELL=0
SKIP_PATH_CHECKS=0
SKIP_PNPM_PRUNE=0
APP_INSTALL_ONLY=0

WASM_OUTPUT="$PUBLIC_DIR/hp_ssh.wasm"
AGENT_OUTPUT="$BUILD_DIR/hp_agent"
FAKE_SHELL_OUTPUT="$BUILD_DIR/hp_fake_sh"

die() { echo "error: $*" >&2; exit 1; }
run() { echo ">> $*"; "$@"; }

while [ $# -gt 0 ]; do
	case "$1" in
		--wasm) BUILD_WASM=1 ;;
		--app) BUILD_APP=1 ;;
		--agent) BUILD_AGENT=1 ;;
		--fake-shell) BUILD_FAKE_SHELL=1 ;;
		--skip-path-checks) SKIP_PATH_CHECKS=1 ;;
		--skip-pnpm-prune) SKIP_PNPM_PRUNE=1 ;;
		--app-install-only) APP_INSTALL_ONLY=1 ;;

		--wasm-output)
			shift
			[ $# -gt 0 ] || die "--wasm-output requires a path"
			WASM_OUTPUT=$1
			;;

		--agent-output)
			shift
			[ $# -gt 0 ] || die "--agent-output requires a path"
			AGENT_OUTPUT=$1
			;;

		--fake-shell-output)
			shift
			[ $# -gt 0 ] || die "--fake-shell-output requires a path"
			FAKE_SHELL_OUTPUT=$1
			;;

		--help)
			cat <<EOF
Usage: $0 [flags]
  --wasm                       build wasm module
  --app                        build react-router app
  --agent                      build tailscale agent
  --fake-shell                 build fake shell binary (for Docker)
  --skip-path-checks           skip safety checks (ie. checking PATH)
  --skip-pnpm-prune            skip pruning devDependencies from node_modules
  --app-install-only           only install app dependencies, skip build
  --wasm-output <path>         override wasm output path
  --agent-output <path>        override agent output path
  --fake-shell-output <path>   override fake shell output path
EOF
			exit 0
			;;
		*)
			die "unknown flag: $1"
			;;
	esac
	shift
done

# By default build everything except for the fake shell
if [ "$BUILD_WASM" -eq 0 ] && [ "$BUILD_APP" -eq 0 ] && \
	[ "$BUILD_AGENT" -eq 0 ] && [ "$BUILD_FAKE_SHELL" -eq 0 ]; then
	BUILD_WASM=1
	BUILD_APP=1
	BUILD_AGENT=1
fi

if [ "$SKIP_PATH_CHECKS" -eq 0 ]; then
	[ -d "$ROOT_DIR" ] || die "missing project root"

	need_go=0
	need_pnpm=0

	[ "$BUILD_WASM" -eq 1 ] && need_go=1
	[ "$BUILD_APP" -eq 1 ] && need_pnpm=1
	[ "$BUILD_AGENT" -eq 1 ] && need_go=1
	[ "$BUILD_FAKE_SHELL" -eq 1 ] && need_go=1

	if [ $need_go -eq 1 ]; then
		echo "==> Checking for Go toolchain"
		command -v go >/dev/null 2>&1 || die "go not installed"
		go version >/dev/null 2>&1 || die "go not working"
	fi

	if [ $need_pnpm -eq 1 ]; then
		echo "==> Checking for node"
		command -v node >/dev/null 2>&1 || die "node not installed"
		node --version >/dev/null 2>&1 || die "node not working"

		echo "==> Checking for pnpm"
		command -v pnpm >/dev/null 2>&1 || die "pnpm not installed"
		pnpm --version >/dev/null 2>&1 || die "pnpm not working"
	fi
fi

build_wasm() {
	echo "==> Building SSH WASM module → $WASM_OUTPUT"
	mkdir -p "$(dirname "$WASM_OUTPUT")"
	echo "// $(go version)" > "$(dirname "$WASM_OUTPUT")/wasm_exec.js"

	# This depends on Go 1.23+ since the path is different in earlier versions
	cat "$(go env GOROOT)/lib/wasm/wasm_exec.js" >> \
		"$(dirname "$WASM_OUTPUT")/wasm_exec.js"

	GOOS=js GOARCH=wasm go build -o "$WASM_OUTPUT" ./cmd/hp_ssh
}

build_app() {
	echo "==> Building React Router app → $BUILD_DIR"
	[ -f "$WASM_OUTPUT" ] || echo "warning: Building without SSH WASM module"
	pnpm install --frozen-lockfile

	if [ "$APP_INSTALL_ONLY" -eq 1 ]; then
		echo "==> Skipping app build (install only)"
		return
	fi

	pnpm run build

	if [ "$SKIP_PNPM_PRUNE" -eq 0 ]; then
		echo "==> Pruning devDependencies from node_modules"
		pnpm prune --prod
	fi
}

build_agent() {
	echo "==> Building Tailscale agent → $AGENT_OUTPUT"
	mkdir -p "$(dirname "$AGENT_OUTPUT")"
	go build -o "$AGENT_OUTPUT" ./cmd/hp_agent
}

build_fake_shell() {
	[ -n "${IMAGE_TAG:-}" ] || die \
		"\$IMAGE_TAG is required to build fake shell binary"

	echo "==> Building fake shell binary → $FAKE_SHELL_OUTPUT"
	mkdir -p "$(dirname "$FAKE_SHELL_OUTPUT")"
	go build -ldflags="-s -w -X main.imageTag=${IMAGE_TAG}" \
		-o "$FAKE_SHELL_OUTPUT" ./cmd/fake_sh
}

[ "$BUILD_FAKE_SHELL" = 1 ] && build_fake_shell

[ "$BUILD_WASM" = 1 ] && build_wasm
[ "$BUILD_APP" = 1 ] && build_app
[ "$BUILD_AGENT" = 1 ] && build_agent
[ "$BUILD_FAKE_SHELL" = 1 ] && build_fake_shell

echo "✅ Build complete."
