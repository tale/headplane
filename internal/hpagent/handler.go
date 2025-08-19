package hpagent

import (
	"bufio"
	"context"
	"fmt"

	"os"

	"github.com/tale/headplane/internal/tsnet"
	"github.com/tale/headplane/internal/util"
)

// Starts listening for messages from stdin
func FollowMaster(agent *tsnet.TSAgent) {
	log := util.GetLogger()
	scanner := bufio.NewScanner(os.Stdin)
	log.Info("Listening for messages from Headplane master on stdin")

	for scanner.Scan() {
		line := scanner.Bytes()
		directive := string(line)

		log.Debug("Received directive from master: %s", directive)
		switch directive {
		case "SHUTDOWN":
			log.Debug("Received SHUTDOWN directive from master, shutting down agent")
			agent.Shutdown()
			return

		case "START":
			log.Debug("Received START directive from master, starting agent")
			// TODO: Start the agent here instead of in main
			fmt.Println("READY " + agent.ID)
			continue

		case "PING":
			log.Debug("Received PING directive from master, responding with PONG")
			fmt.Println("PONG " + agent.ID)
			continue

		case "REFRESH":
			log.Debug("Received REFRESH directive from master, refreshing status for all nodes")
			err := agent.DispatchHostInfo(context.Background())
			if err != nil {
				log.Error("Error refreshing host info: %s", err)
				fmt.Println("ERR " + err.Error())
			}
		}
	}

	if err := scanner.Err(); err != nil {
		log.Fatal("Error reading from stdin: %s", err)
	}
}
