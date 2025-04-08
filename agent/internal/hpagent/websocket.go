package hpagent

import (
	"fmt"
	"net/http"
	"net/url"

	"github.com/gorilla/websocket"
	"github.com/tale/headplane/agent/internal/config"
	"github.com/tale/headplane/agent/internal/tsnet"
	"github.com/tale/headplane/agent/internal/util"
)

type Socket struct {
	*websocket.Conn
	Agent *tsnet.TSAgent
}

// Creates a new websocket connection to the Headplane server.
func NewSocket(agent *tsnet.TSAgent, cfg *config.Config) (*Socket, error) {
	log := util.GetLogger()

	wsURL, err := httpToWs(cfg.HPControlURL)
	if err != nil {
		return nil, err
	}

	headers := http.Header{}
	headers.Add("X-Headplane-Tailnet-ID", agent.ID)
	auth := fmt.Sprintf("Bearer %s", cfg.HPAuthKey)
	headers.Add("Authorization", auth)

	log.Info("Dialing WebSocket with master: %s", wsURL)
	ws, _, err := websocket.DefaultDialer.Dial(wsURL, headers)
	if err != nil {
		log.Debug("Failed to dial WebSocket: %s", err)
		return nil, err
	}

	return &Socket{ws, agent}, nil
}

// We need to convert the control URL to a websocket URL
func httpToWs(controlURL string) (string, error) {
	log := util.GetLogger()
	u, err := url.Parse(controlURL)
	if err != nil {
		log.Debug("Failed to parse control URL: %s", err)
		return "", err
	}

	if u.Scheme == "http" {
		u.Scheme = "ws"
	} else if u.Scheme == "https" {
		u.Scheme = "wss"
	} else {
		return "", fmt.Errorf("unsupported scheme: %s", u.Scheme)
	}

	// We also need to append /_dial to the path
	if u.Path[len(u.Path)-1] != '/' {
		u.Path += "/"
	}

	u.Path += "_dial"
	return u.String(), nil
}
