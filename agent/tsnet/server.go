package tsnet

import (
	"context"
	"fmt"
	"log"
	"os"

	"tailscale.com/client/tailscale"
	"tailscale.com/tsnet"
)

// Wrapper type so we can add methods to the server.
type TSAgent struct {
	*tsnet.Server
	Lc *tailscale.LocalClient
	ID string
	Debug bool
}

// Creates a new tsnet agent and returns an instance of the server.
func NewAgent(hostname, controlURL, authKey string, debug bool) *TSAgent {
	s := &tsnet.Server{
		Hostname:   hostname,
		ControlURL: controlURL,
		AuthKey:    authKey,
		Logf:       func(string, ...interface{}) {}, // Disabled by default
	}

	if debug {
		s.Logf = log.New(
			os.Stderr,
			fmt.Sprintf("[DBG:%s] ", hostname),
			log.LstdFlags,
		).Printf
	}

	return &TSAgent{s, nil, "", debug}
}

// Starts the tsnet agent and sets the node ID.
func (s *TSAgent) StartAndFetchID() {
	// Waits until the agent is up and running.
	status, err := s.Up(context.Background())
	if err != nil {
		log.Fatalf("Failed to start agent: %v", err)
	}

	s.Lc, err = s.LocalClient()
	if err != nil {
		log.Fatalf("Failed to create local client: %v", err)
	}

	log.Printf("Agent running with ID: %s", status.Self.PublicKey)
	s.ID = string(status.Self.ID)
}

// Shuts down the tsnet agent.
func (s *TSAgent) Shutdown() {
	s.Close()
}
