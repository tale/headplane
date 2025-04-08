package tsnet

import (
	"context"
	"github.com/tale/headplane/agent/internal/config"
	"github.com/tale/headplane/agent/internal/util"
	"tailscale.com/client/tailscale"
	"tailscale.com/tsnet"
)

// Wrapper type so we can add methods to the server.
type TSAgent struct {
	*tsnet.Server
	Lc *tailscale.LocalClient
	ID string
}

// Creates a new tsnet agent and returns an instance of the server.
func NewAgent(cfg *config.Config) *TSAgent {
	server := &tsnet.Server{
		Hostname:   cfg.Hostname,
		ControlURL: cfg.TSControlURL,
		AuthKey:    cfg.TSAuthKey,
		Logf:       func(string, ...interface{}) {}, // Disabled by default
	}

	if cfg.Debug {
		log := util.GetLogger()
		server.Logf = log.Debug
	}

	return &TSAgent{server, nil, ""}
}

// Starts the tsnet agent and sets the node ID.
func (s *TSAgent) Connect() {
	log := util.GetLogger()

	// Waits until the agent is up and running.
	status, err := s.Up(context.Background())
	if err != nil {
		log.Fatal("Failed to connect to Tailnet: %s", err)
	}

	s.Lc, err = s.LocalClient()
	if err != nil {
		log.Fatal("Failed to initialize local Tailscale client: %s", err)
	}

	log.Info("Connected to Tailnet (PublicKey: %s)", status.Self.PublicKey)
	s.ID = string(status.Self.ID)
}

// Shuts down the tsnet agent.
func (s *TSAgent) Shutdown() {
	s.Close()
}
