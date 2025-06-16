package main

import (
	_ "github.com/joho/godotenv/autoload"
	"github.com/tale/headplane/internal/config"
	"github.com/tale/headplane/internal/hpagent"
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

	agent.Connect()
	defer agent.Shutdown()

	log.Msg(&Register{
		Type: "register",
		ID:   agent.ID,
	})

	hpagent.FollowMaster(agent)
}
