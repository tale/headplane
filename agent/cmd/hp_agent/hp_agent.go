package main

import (
	_ "github.com/joho/godotenv/autoload"
	"github.com/tale/headplane/agent/config"
	"github.com/tale/headplane/agent/tsnet"
	"github.com/tale/headplane/agent/hpagent"
	"log"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %s", err)
	}

	agent := tsnet.NewAgent(
		cfg.Hostname,
		cfg.TSControlURL,
		cfg.TSAuthKey,
		cfg.Debug,
	)

	agent.StartAndFetchID()
	defer agent.Shutdown()

	ws, err := hpagent.NewSocket(
		agent,
		cfg.HPControlURL,
		cfg.HPAuthKey,
		cfg.Debug,
	)

	if err != nil {
		log.Fatalf("Failed to create websocket: %s", err)
	}

	defer ws.StopListening()
	ws.StartListening()
}
