#!/bin/sh
# Resyncs cmd/hp_ssh/wasm_js.go with tailscale.com/cmd/tsconnect and reapplies
# the local patch. Pass the upstream ref to move to; defaults to the ref the
# vendored file currently records.
#
# After a successful sync, bump tailscale.com in go.mod to a release that
# contains the ref, or the file will not compile.

set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR" || exit 1

TARGET="cmd/hp_ssh/wasm_js.go"
TYPES="app/routes/ssh/wasm_js.d.ts"
PATCH="patches/tsconnect-term-type.patch"
TYPES_PATCH="patches/tsconnect-types.patch"
RAW="https://raw.githubusercontent.com/tailscale/tailscale"

die() { echo "error: $*" >&2; exit 1; }

REF=${1:-$(sed -n 's/^\/\/ Upstream ref: //p' "$TARGET")}
[ -n "$REF" ] || die "no upstream ref given and none recorded in $TARGET"

echo "==> Syncing tsconnect at $REF"
command -v go >/dev/null 2>&1 || die "go not installed"

HEADER=$(mktemp)
trap 'rm -f "$HEADER" "$HEADER.go"' EXIT

cat > "$HEADER" <<HDR
// Copyright (c) Tailscale Inc & contributors
// SPDX-License-Identifier: BSD-3-Clause

// Vendored from tailscale.com/cmd/tsconnect/wasm/wasm_js.go.
// Upstream ref: $REF
//
// Local changes live in $PATCH and are already
// applied here. Run scripts/sync-tsconnect.sh to move to a newer upstream.

HDR

curl -fsSL "$RAW/$REF/cmd/tsconnect/wasm/wasm_js.go" > "$HEADER.go" ||
	die "failed to fetch wasm_js.go at $REF"

# Upstream's first three lines are the license header we replace.
cat "$HEADER" > "$TARGET"
tail -n +4 "$HEADER.go" >> "$TARGET"

echo "==> Applying $PATCH"
patch --no-backup-if-mismatch "$TARGET" < "$PATCH" || die "patch conflict — resolve by hand, then rewrite $PATCH"

echo "==> Refreshing $TYPES"
curl -fsSL "$RAW/$REF/cmd/tsconnect/src/types/wasm_js.d.ts" > "$TYPES" ||
	die "failed to fetch wasm_js.d.ts at $REF"

echo "==> Applying $TYPES_PATCH"
patch --no-backup-if-mismatch "$TYPES" < "$TYPES_PATCH" || die "patch conflict — resolve by hand, then rewrite $TYPES_PATCH"

echo "==> Regenerating build tags"
GOFLAGS=-mod=mod go run scripts/wasm-tags.go > cmd/hp_ssh/build-tags.txt

gofmt -w "$TARGET"
echo "==> Done. Rebuild with ./build.sh --wasm"
