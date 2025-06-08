package tsnet

import (
	"context"
	"os"
	"path/filepath"

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
	log := util.GetLogger()

	dir, err := filepath.Abs(cfg.WorkDir)
	if err != nil {
		log.Fatal("Failed to get absolute path: %s", err)
	}

	if err := os.MkdirAll(dir, 0700); err != nil {
		log.Fatal("Cannot create agent work directory: %s", err)
	}

	server := &tsnet.Server{
		Dir:        dir,
		Hostname:   cfg.Hostname,
		ControlURL: cfg.TSControlURL,
		AuthKey:    cfg.TSAuthKey,
		Logf:       func(string, ...any) {}, // Disabled by default
		UserLogf:   log.Info,
	}

	if cfg.Debug {
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

	id, err := status.Self.PublicKey.MarshalText()
	if err != nil {
		log.Fatal("Failed to marshal public key: %s", err)
	}

	log.Info("Connected to Tailnet (PublicKey: %s)", status.Self.PublicKey)
	s.ID = string(id)
}

// Shuts down the tsnet agent.
func (s *TSAgent) Shutdown() {
	s.Close()
}
