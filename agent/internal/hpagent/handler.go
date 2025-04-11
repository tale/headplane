package hpagent

import (
	"bufio"
	"encoding/json"
	"os"
	"sync"

	"github.com/tale/headplane/agent/internal/tsnet"
	"github.com/tale/headplane/agent/internal/util"
	"tailscale.com/tailcfg"
)

// Represents messages from the Headplane master
type RecvMessage struct {
	NodeIDs []string
}

type SendMessage struct {
	Type string
	Data any
}

// Starts listening for messages from stdin
func FollowMaster(agent *tsnet.TSAgent) {
	log := util.GetLogger()
	scanner := bufio.NewScanner(os.Stdin)

	for scanner.Scan() {
		line := scanner.Bytes()

		var msg RecvMessage
		err := json.Unmarshal(line, &msg)
		if err != nil {
			log.Error("Unable to unmarshal message: %s", err)
			log.Debug("Full Error: %v", err)
			continue
		}

		log.Debug("Recieved message from master: %v", line)

		if len(msg.NodeIDs) == 0 {
			log.Debug("Message recieved had no node IDs")
			log.Debug("Full message: %s", line)
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
				result, err := agent.GetStatusForPeer(nodeID)
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
		log.Msg(&SendMessage{
			Type: "status",
			Data: results,
		})
	}

	if err := scanner.Err(); err != nil {
		log.Fatal("Error reading from stdin: %s", err)
	}
}
