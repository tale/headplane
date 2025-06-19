package tsnet

import (
	"context"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/tale/headplane/agent/internal/util"
	"tailscale.com/tailcfg"
	"tailscale.com/types/key"

	"go4.org/mem"
)

// Returns the raw hostinfo for a peer based on node ID.
func (s *TSAgent) GetStatusForPeer(id string) (*tailcfg.HostinfoView, error) {
	log := util.GetLogger()

	if !strings.HasPrefix(id, "nodekey:") {
		log.Debug("Node ID with missing prefix: %s", id)
		return nil, fmt.Errorf("invalid node ID: %s", id)
	}

	log.Debug("Querying status of peer: %s", id)
	status, err := s.Lc.Status(context.Background())
	if err != nil {
		log.Debug("Failed to get status: %s", err)
		return nil, fmt.Errorf("failed to get status: %w", err)
	}

	// We need to convert from 64 char hex to 32 byte raw.
	bytes, err := hex.DecodeString(id[8:])
	if err != nil {
		log.Debug("Failed to decode hex: %s", err)
		return nil, fmt.Errorf("failed to decode hex: %w", err)
	}

	raw := mem.B(bytes)
	if raw.Len() != 32 {
		log.Debug("Invalid node ID length: %d", raw.Len())
		return nil, fmt.Errorf("invalid node ID length: %d", raw.Len())
	}

	nodeKey := key.NodePublicFromRaw32(raw)
	peer := status.Peer[nodeKey]
	if peer == nil {
		// Check if we are on Self.
		if status.Self.PublicKey == nodeKey {
			peer = status.Self
		} else {
			log.Debug("Peer not found in status: %s", id)
			return nil, nil
		}
	}

	ip := peer.TailscaleIPs[0].String()
	whois, err := s.Lc.WhoIs(context.Background(), ip)
	if err != nil {
		log.Debug("Failed to get whois: %s", err)
		return nil, fmt.Errorf("failed to get whois: %w", err)
	}

	log.Debug("Got whois for peer %s: %v", id, whois)
	return &whois.Node.Hostinfo, nil
}
