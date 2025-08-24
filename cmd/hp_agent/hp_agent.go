package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/tale/headplane/internal/config"
	"github.com/tale/headplane/internal/tsnet"
	"github.com/tale/headplane/internal/util"
)

type Register struct {
	Type string
	ID   string
}

func main() {
	log := util.GetLogger()
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("Failed to load config: %s", err)
	}

	log.SetDebug(cfg.Debug)
	agent := tsnet.NewAgent(cfg)
	defer agent.Shutdown()

	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := scanner.Bytes()
		directive := strings.TrimSpace(string(line))
		log.Debug("Received directive: %s", directive)

		switch directive {
		case "START":
			agent.Connect()
			fmt.Printf("READY %s\n", agent.ID)

		case "SHUTDOWN":
			agent.Shutdown()
			os.Exit(0)

		case "PING":
			fmt.Printf("PONG %s\n", agent.ID)

		case "REFRESH":
			err := agent.DispatchHostInfo(context.Background())
			if err != nil {
				fmt.Printf("ERROR %s\n", err)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		fmt.Printf("ERROR %s\n", err)
		os.Exit(1)
	}
}
