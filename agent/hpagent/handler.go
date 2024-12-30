package hpagent

import (
	"encoding/json"
	"log"
	"sync"
	"tailscale.com/tailcfg"
)

// Represents messages from the Headplane master
type RecvMessage struct {
	NodeIDs []string `json:omitempty`
}

// Starts listening for messages from the Headplane master
func (s *Socket) StartListening() {
	for {
		_, message, err := s.ReadMessage()
		if err != nil {
			log.Printf("error reading message: %v", err)
			return
		}

		var msg RecvMessage
		err = json.Unmarshal(message, &msg)
		if err != nil {
			log.Printf("error unmarshalling message: %v", err)
			continue
		}

		if s.Debug {
			log.Printf("got message: %s", message)
		}

		if len(msg.NodeIDs) == 0 {
			log.Printf("got a message with no node IDs? %s", message)
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
					log.Printf("error getting status: %v", err)
					return
				}

				if result == nil {
					return
				}

				mu.Lock()
				results[nodeID] = result
				mu.Unlock()
			}(nodeID)
		}

		wg.Wait()

		// Send the results back to the Headplane master
		err = s.SendStatus(results)
		if err != nil {
			log.Printf("error sending status: %v", err)
			return
		}

		if s.Debug {
			log.Printf("sent status: %s", results)
		}
	}
}

// Stops listening for messages from the Headplane master
func (s *Socket) StopListening() {
	s.Close()
}
