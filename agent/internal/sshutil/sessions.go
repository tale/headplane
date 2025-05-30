package sshutil

import (
	"io"
	"sync"

	"golang.org/x/crypto/ssh"
)

type SessionContext struct {
	ID      string
	Session *ssh.Session
	Stdin   io.WriteCloser
	Stdout  io.Reader
	InputCh chan []byte
}

var sessions = make(map[string]*SessionContext)
var sessionsMu sync.RWMutex

func addSession(id string, session *ssh.Session) *SessionContext {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()

	if _, exists := sessions[id]; exists {
		return nil // Session with this ID already exists
	}

	stdin, err := session.StdinPipe()
	if err != nil {
		return nil // Handle error appropriately in production code
	}

	stdout, err := session.StdoutPipe()
	if err != nil {
		stdin.Close() // Close stdin if stdout pipe creation fails
		return nil // Handle error appropriately in production code
	}

	sessionContext := &SessionContext{
		ID:      id,
		Session: session,
		Stdin:   stdin,
		Stdout:  stdout,
	}

	sessions[id] = sessionContext
	return sessionContext
}

func GetSession(id string) *SessionContext {
	sessionsMu.RLock()
	defer sessionsMu.RUnlock()

	return sessions[id] // Returns nil if session does not exist
}

func RemoveSession(id string) {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()

	if sessionContext, exists := sessions[id]; exists {
		sessionContext.Stdin.Close() // Close the stdin pipe
		sessionContext.Session.Close() // Close the SSH session
		delete(sessions, id) // Remove from the map
	}
}
