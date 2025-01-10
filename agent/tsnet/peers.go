package tsnet

import (
	"context"
	"fmt"
	"log"
	"strings"
	"tailscale.com/tailcfg"
	"tailscale.com/types/key"

	"go4.org/mem"
)

// Returns the raw hostinfo for a peer based on node ID.
func (s *TSAgent) GetStatusForPeer(id string) (*tailcfg.HostinfoView, error) {
	if !strings.HasPrefix(id, "nodekey:") {
		return nil, fmt.Errorf("invalid node ID: %s", id)
	}

	if s.Debug {
		log.Printf("querying peer state for %s", id)
	}

	status, err := s.Lc.Status(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get status: %w", err)
	}

	nodeKey, err := key.ParseNodePublicUntyped(mem.S(id[8:]))
	peer := status.Peer[nodeKey]
	if peer == nil {
		// Check if we are on Self.
		if status.Self.PublicKey == nodeKey {
			peer = status.Self
		} else {
			return nil, nil
		}
	}

	ip := peer.TailscaleIPs[0].String()
	whois, err := s.Lc.WhoIs(context.Background(), ip)
	if err != nil {
		return nil, fmt.Errorf("failed to get whois: %w", err)
	}

	return &whois.Node.Hostinfo, nil
}
