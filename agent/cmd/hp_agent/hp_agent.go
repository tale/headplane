package main

import (
	_ "github.com/joho/godotenv/autoload"
	"github.com/tale/headplane/agent/internal/config"
	"github.com/tale/headplane/agent/internal/hpagent"
	"github.com/tale/headplane/agent/internal/tsnet"
	"github.com/tale/headplane/agent/internal/util"
)

func main() {
	log := util.GetLogger()
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("Failed to load config: %s", err)
	}

	log.SetDebug(cfg.Debug)
	agent := tsnet.NewAgent(cfg)

	agent.Connect()
	defer agent.Shutdown()

	ws, err := hpagent.NewSocket(agent, cfg)
	if err != nil {
		log.Fatal("Failed to create websocket: %s", err)
	}

	defer ws.StopListening()
	ws.FollowMaster()
}
