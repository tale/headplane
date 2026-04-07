package main

import (
	"bufio"
	"context"
	"encoding/json"
	"os"
	"os/signal"
	"syscall"

	"github.com/tale/headplane/internal/config"
	"github.com/tale/headplane/internal/tsnet"
	"github.com/tale/headplane/internal/util"
)

type output struct {
	Self  string                     `json:"self"`
	Hosts map[string]json.RawMessage `json:"hosts"`
}

type errorOutput struct {
	Error string `json:"error"`
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

	agent.Connect()

	enc := json.NewEncoder(os.Stdout)
	scanner := bufio.NewScanner(os.Stdin)

	// Shut down cleanly on signal or stdin close
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		<-sigCh
		agent.Shutdown()
		os.Exit(0)
	}()

	// Each line on stdin triggers a sync. The line content is ignored.
	for scanner.Scan() {
		hosts, err := agent.FetchAllHostInfo(context.Background())
		if err != nil {
			enc.Encode(errorOutput{Error: err.Error()})
			continue
		}

		enc.Encode(output{
			Self:  agent.ID,
			Hosts: hosts,
		})
	}
}
