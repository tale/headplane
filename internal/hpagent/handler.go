package hpagent

import (
	"bufio"
	"bytes"
	// "encoding/json"
	"os"
	// "sync"

	"github.com/fxamacker/cbor/v2"
	"github.com/tale/headplane/agent/internal/sshutil"
	"github.com/tale/headplane/agent/internal/tsnet"
	"github.com/tale/headplane/agent/internal/util"
	// "tailscale.com/tailcfg"
)

// Represents messages from the Headplane master
type RecvMessage struct {
	NodeIDs []string
}

type CborMessage struct {
	Op      string          `cbor:"op"`
	Payload cbor.RawMessage `cbor:"payload"`
}

type SendMessage struct {
	Type string
	Data any
}

// Starts listening for messages from stdin
func FollowMaster(agent *tsnet.TSAgent) {
	log := util.GetLogger()
	scanner := bufio.NewScanner(os.Stdin)
	log.Info("Listening for messages from Headplane master on stdin")

	for scanner.Scan() {
		line := scanner.Bytes()

		var msg CborMessage
		decoder := cbor.NewDecoder(bytes.NewReader(line))
		err := decoder.Decode(&msg)

		if err != nil {
			log.Error("Unable to decode message from master: %s", err)
			continue
		}

		log.Debug("Received message from master: %s", msg)
		switch msg.Op {
		case "ssh_conn":
			var sshPayload sshutil.SSHConnectPayload
			err = cbor.Unmarshal(msg.Payload, &sshPayload)
			if err != nil {
				log.Error("Unable to unmarshal SSH connect payload: %s", err)
				continue
			}

			sshutil.StartWebSSH(agent, sshPayload)
			continue

		case "ssh_term":
			var sshPayload sshutil.SSHClosePayload
			err = cbor.Unmarshal(msg.Payload, &sshPayload)
			if err != nil {
				log.Error("Unable to unmarshal SSH close payload: %s", err)
				continue
			}

			sshutil.CloseWebSSH(agent, sshPayload)
			continue

		case "ssh_resize":
			var sshPayload sshutil.SSHResizePayload
			err = cbor.Unmarshal(msg.Payload, &sshPayload)
			if err != nil {
				log.Error("Unable to unmarshal SSH resize payload: %s", err)
				continue
			}

			sshutil.ResizeWebSSH(agent, sshPayload)
			continue
		}
	}

	// 	var msg RecvMessage
	// 	err := json.Unmarshal(line, &msg)
	// 	if err != nil {
	// 		var cborMsg CborMessage
	// 		dec := cbor.NewDecoder(bytes.NewReader(line))
	// 		err := dec.Decode(&cborMsg)

	// 		if err == nil {
	// 			log.Info("Unmarshalled CBOR message: %s", cborMsg)
	// 			var sshPayload SSHConnect
	// 			err = cbor.Unmarshal(cborMsg.Payload, &sshPayload)
	// 			sshutil.OpenSshPty(agent, sshutil.SshConnectParams{
	// 				Hostname: sshPayload.Hostname,
	// 				Port: sshPayload.Port,
	// 				Username: sshPayload.Username,
	// 				Id: sshPayload.SessionId,
	// 			})

	// 			return;
	// 		}

	// 		log.Error("Unable to unmarshal message: %s", err)
	// 		log.Debug("Full Error: %v", err)
	// 		continue
	// 	}

	// 	log.Debug("Recieved message from master: %v", line)

	// 	if len(msg.NodeIDs) == 0 {
	// 		log.Debug("Message recieved had no node IDs")
	// 		log.Debug("Full message: %s", line)
	// 		continue
	// 	}

	// 	// Accumulate the results since we invoke via gofunc
	// 	results := make(map[string]*tailcfg.HostinfoView)
	// 	mu := sync.Mutex{}
	// 	wg := sync.WaitGroup{}

	// 	for _, nodeID := range msg.NodeIDs {
	// 		wg.Add(1)
	// 		go func(nodeID string) {
	// 			defer wg.Done()
	// 			result, err := agent.GetStatusForPeer(nodeID)
	// 			if err != nil {
	// 				log.Error("Unable to get status for node %s: %s", nodeID, err)
	// 				return
	// 			}

	// 			if result == nil {
	// 				log.Debug("No status for node %s", nodeID)
	// 				return
	// 			}

	// 			mu.Lock()
	// 			results[nodeID] = result
	// 			mu.Unlock()
	// 		}(nodeID)
	// 	}

	// 	wg.Wait()

	// 	// Send the results back to the Headplane master
	// 	log.Debug("Sending status back to master: %v", results)
	// 	log.Msg(&SendMessage{
	// 		Type: "status",
	// 		Data: results,
	// 	})
	// }

	// if err := scanner.Err(); err != nil {
	// 	log.Fatal("Error reading from stdin: %s", err)
	// }
}
