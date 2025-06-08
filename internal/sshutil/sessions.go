package sshutil

import (
	"errors"
	"io"
	"sync"

	"github.com/tale/headplane/agent/internal/util"
	"golang.org/x/crypto/ssh"
)

type SessionContext struct {
	ID      string
	Session *ssh.Session
	Stdin   io.WriteCloser
	Stdout  io.Reader
	Stderr  io.Reader
	InputCh chan []byte
}

var sessions = make(map[string]*SessionContext)
var sessionsLock sync.RWMutex

func registerSessionChans(id string, session *ssh.Session) (*SessionContext, error) {
	log := util.GetLogger()

	sessionsLock.Lock()
	defer sessionsLock.Unlock()

	if _, exists := sessions[id]; exists {
		return sessions[id], nil
	}

	stdin, err := session.StdinPipe()
	if err != nil {
		return nil, errors.New("failed to create stdin pipe: " + err.Error())
	}

	stdout, err := session.StdoutPipe()
	if err != nil {
		stdin.Close()
		return nil, errors.New("failed to create stdout pipe: " + err.Error())
	}

	stderr, err := session.StderrPipe()
	if err != nil {
		stdin.Close()
		return nil, errors.New("failed to create stderr pipe: " + err.Error())
	}

	ctx := &SessionContext{
		ID:      id,
		Session: session,
		Stdin:   stdin,
		Stdout:  stdout,
		Stderr:  stderr,
		// Buffered channel to queue input data
		InputCh: make(chan []byte, 256),
	}

	sessions[id] = ctx
	log.Debug("Registered session %s with stdin, stdout, and stderr pipes", id)
	return ctx, nil
}

func lookupSession(id string) (*SessionContext, bool) {
	sessionsLock.RLock()
	defer sessionsLock.RUnlock()

	sessionContext, exists := sessions[id]
	return sessionContext, exists
}

func RemoveSession(id string) {
	sessionsLock.Lock()
	defer sessionsLock.Unlock()

	if sessionContext, exists := sessions[id]; exists {
		sessionContext.Stdin.Close()   // Close the stdin pipe
		sessionContext.Session.Close() // Close the SSH session
		delete(sessions, id)           // Remove from the map
	}
}
