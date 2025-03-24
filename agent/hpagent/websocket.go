package hpagent

import (
	"fmt"
	"log"
	"net/http"
	"net/url"

	"github.com/gorilla/websocket"
	"github.com/tale/headplane/agent/tsnet"
)

type Socket struct {
	*websocket.Conn
	Debug bool
	Agent *tsnet.TSAgent
}

// Creates a new websocket connection to the Headplane server.
func NewSocket(agent *tsnet.TSAgent, controlURL, authKey string, debug bool) (*Socket, error) {
	wsURL, err := httpToWs(controlURL)
	if err != nil {
		return nil, err
	}

	headers := http.Header{}
	headers.Add("X-Headplane-Tailnet-ID", agent.ID)

	auth := fmt.Sprintf("Bearer %s", authKey)
	headers.Add("Authorization", auth)

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

	// We also need to append /_dial to the path
	if u.Path[len(u.Path)-1] != '/' {
		u.Path += "/"
	}

	u.Path += "_dial"
	return u.String(), nil
}
