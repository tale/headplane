package main

import (
	"context"
	"encoding/json"
	"os"

	"github.com/tale/headplane/internal/config"
	"github.com/tale/headplane/internal/tsnet"
	"github.com/tale/headplane/internal/util"
)

func main() {
	log := util.GetLogger()
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("Failed to load config: %s", err)
	}

	log.SetDebug(cfg.Debug)
	agent := tsnet.NewAgent(cfg)
	defer agent.Shutdown()

	agent.Connect()

	hosts, err := agent.FetchAllHostInfo(context.Background())
	if err != nil {
		log.Fatal("Failed to fetch host info: %s", err)
	}

	output := struct {
		Self  string                     `json:"self"`
		Hosts map[string]json.RawMessage `json:"hosts"`
	}{
		Self:  agent.ID,
		Hosts: hosts,
	}

	enc := json.NewEncoder(os.Stdout)
	if err := enc.Encode(output); err != nil {
		log.Fatal("Failed to encode result: %s", err)
	}
}
