//go:build ignore

// Regenerates cmd/hp_ssh/build-tags.txt, the -tags value for the SSH WASM
// build. Run via scripts/sync-tsconnect.sh, not at build time: wasmbuild is
// not an import of this module, so it is absent from a vendored tree.
//
// Tailscale computes this list from its own feature registry, so it tracks
// upstream automatically. We drop tailscale_go because it needs Tailscale's
// forked Go toolchain (runtime.TailscaleCurrentP); everything else is a
// ts_omit_* tag that strips server-only features from the browser bundle.
package main

import (
	"fmt"
	"strings"

	"tailscale.com/cmd/tsconnect/wasmbuild"
)

func main() {
	tagList := strings.Split(wasmbuild.Tags(), ",")
	keptList := make([]string, 0, len(tagList))

	for _, tag := range tagList {
		if tag != "tailscale_go" {
			keptList = append(keptList, tag)
		}
	}

	fmt.Println(strings.Join(keptList, ","))
}
