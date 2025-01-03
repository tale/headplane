package hpagent

import (
	"fmt"
	"github.com/gorilla/websocket"
	"github.com/tale/headplane/agent/tsnet"
	"log"
	"net/http"
	"net/url"
)

type Socket struct {
	*websocket.Conn
	Debug bool
	Agent *tsnet.TSAgent
}

// Creates a new websocket connection to the Headplane server.
func NewSocket(agent *tsnet.TSAgent, controlURL string, debug bool) (*Socket, error) {
	wsURL, err := httpToWs(controlURL)
	if err != nil {
		return nil, err
	}

	headers := http.Header{}
	headers.Add("X-Headplane-TS-Node-ID", agent.ID)

	log.Printf("dialing websocket at %s", wsURL)
	ws, _, err := websocket.DefaultDialer.Dial(wsURL, headers)
	if err != nil {
		return nil, err
	}

	return &Socket{ws, debug, agent}, nil
}

// We need to convert the control URL to a websocket URL
func httpToWs(controlURL string) (string, error) {
	u, err := url.Parse(controlURL)
	if err != nil {
		return "", err
	}

	if u.Scheme == "http" {
		u.Scheme = "ws"
	} else if u.Scheme == "https" {
		u.Scheme = "wss"
	} else {
		return "", fmt.Errorf("unsupported scheme: %s", u.Scheme)
	}

	return u.String(), nil
}