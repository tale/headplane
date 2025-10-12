package tsnet

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/tale/headplane/internal/util"
	"tailscale.com/ipn/ipnstate"
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

// Dispatches ALL the HostInfo entries in our Tailnet to the master
func (s *TSAgent) DispatchHostInfo(ctx context.Context) error {
	log := util.GetLogger()

	stat, err := s.Lc.Status(ctx)
	if err != nil {
		log.Debug("Failed to get status: %s", err)
		return fmt.Errorf("failed to get status: %w", err)
	}

	// Do lookups for all peers with a hint of parallelism for speed!
	const maxParallel = 8
	sema := make(chan struct{}, maxParallel)
	var wg sync.WaitGroup
	var mu sync.Mutex

	nodeMap := make(map[key.NodePublic]*ipnstate.PeerStatus)
	nodeMap[stat.Self.PublicKey] = stat.Self
	for nodeKey, peer := range stat.Peer {
		if peer == nil {
			log.Debug("Skipping nil peer for node key: %s", nodeKey)
			continue
		}

		nodeMap[nodeKey] = peer
	}

	for nodeKey, peer := range nodeMap {
		idBytes, err := nodeKey.MarshalText()
		if err != nil {
			log.Debug("Failed to marshal node key: %s", err)
			continue
		}

		nodeID := string(idBytes)
		wg.Add(1)
		sema <- struct{}{}

		go func() {
			defer wg.Done()
			defer func() { <-sema }()

			wctx, cancel := context.WithTimeout(ctx, 3*time.Second)
			defer cancel()

			ip := peer.TailscaleIPs[0].String()
			if len(ip) == 0 {
				log.Debug("Peer %s has no Tailscale IPs", nodeID)
				return
			}

			whois, err := s.Lc.WhoIs(wctx, ip)
			if err != nil {
				log.Debug("WhoIs failed for %s (%s): %s", nodeID, ip, err)
				return
			}

			if whois == nil || whois.Node == nil {
				log.Debug("WhoIs returned nil node for %s (%s)", nodeID, ip)
				return
			}

			data, err := json.Marshal(whois.Node.Hostinfo)
			if err != nil {
				log.Debug("Failed to marshal hostinfo for %s (%s): %s", nodeID, ip, err)
				return
			}

			mu.Lock()
			fmt.Println("HOSTINFO " + nodeID + " " + string(data))
			mu.Unlock()
		}()
	}

	wg.Wait()
	return nil
}
