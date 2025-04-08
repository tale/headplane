package hpagent

import (
	"encoding/json"
	"sync"

	"github.com/tale/headplane/agent/internal/util"
	"tailscale.com/tailcfg"
)

// Represents messages from the Headplane master
type RecvMessage struct {
	NodeIDs []string
}

// Starts listening for messages from the Headplane master
func (s *Socket) FollowMaster() {
	log := util.GetLogger()

	for {
		_, message, err := s.ReadMessage()
		if err != nil {
			log.Error("Error reading message: %s", err)
			return
		}

		var msg RecvMessage
		err = json.Unmarshal(message, &msg)
		if err != nil {
			log.Error("Unable to unmarshal message: %s", err)
			log.Debug("Full Error: %v", err)
			continue
		}

		log.Debug("Recieved message from master: %v", message)

		if len(msg.NodeIDs) == 0 {
			log.Debug("Message recieved had no node IDs")
			log.Debug("Full message: %s", message)
			continue
		}

		// Accumulate the results since we invoke via gofunc
		results := make(map[string]*tailcfg.HostinfoView)
		mu := sync.Mutex{}
		wg := sync.WaitGroup{}

		for _, nodeID := range msg.NodeIDs {
			wg.Add(1)
			go func(nodeID string) {
				defer wg.Done()
				result, err := s.Agent.GetStatusForPeer(nodeID)
				if err != nil {
					log.Error("Unable to get status for node %s: %s", nodeID, err)
					return
				}

				if result == nil {
					log.Debug("No status for node %s", nodeID)
					return
				}

				mu.Lock()
				results[nodeID] = result
				mu.Unlock()
			}(nodeID)
		}

		wg.Wait()

		// Send the results back to the Headplane master
		log.Debug("Sending status back to master: %v", results)
		err = s.SendStatus(results)
		if err != nil {
			log.Error("Error sending status: %s", err)
			return
		}
	}
}

// Stops listening for messages from the Headplane master
func (s *Socket) StopListening() {
	s.Close()
}
