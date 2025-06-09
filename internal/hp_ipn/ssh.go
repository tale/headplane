//go:build js && wasm

package hp_ipn

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"net"
	"time"

	"golang.org/x/crypto/ssh"
)

// Represents an SSH session over the Tailnet.
type SSHSession struct {
	// Hostname on the Tailnet.
	Hostname string

	// Username for the SSH connection.
	Username string

	// Xterm configuration for the SSH session.
	TermConfig *SSHXtermConfig

	// Handle to the current IPN connection.
	Ipn *TsWasmIpn

	// Handle to the current SSH session.
	Pty *ssh.Session

	// Tracks resize notifications for rows.
	ResizeRows int

	// Tracks resize notifications for columns.
	ResizeCols int
}

// Creates a new SSH session given a hostname and username.
func (i *TsWasmIpn) NewSSHSession(hostname, username string, termConfig *SSHXtermConfig) *SSHSession {
	return &SSHSession{
		Hostname:   hostname,
		Username:   username,
		TermConfig: termConfig,
		Ipn:        i,
	}
}

func (s *SSHSession) ConnectAndRun() {
	defer s.TermConfig.OnDisconnect()

	// Default to a 5 second timeout for the connection AFTER dial.
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// TODO: Log here
	log.Printf("Attempting SSH dial to host: %s", net.JoinHostPort(s.Hostname, "22"))
	conn, err := s.Ipn.dialer.UserDial(ctx, "tcp", net.JoinHostPort(s.Hostname, "22"))
	if err != nil {
		log.Printf("SSH dial error: %v", err)
		s.writeError("Dial", err)
		return
	}

	defer conn.Close()
	sshConf := &ssh.ClientConfig{
		User: s.Username,
		HostKeyCallback: func(hostname string, remote net.Addr, key ssh.PublicKey) error {
			// Tailscale SSH doesn't use host keys
			// TODO: Log that the connection was established
			return nil
		},
	}

	// TODO: LOG: Starting SSH Client
	sshConn, _, _, err := ssh.NewClientConn(conn, s.Hostname, sshConf)
	if err != nil {
		s.writeError("SSH", err)
		return
	}

	defer sshConn.Close()
	sshClient := ssh.NewClient(sshConn, nil, nil)
	defer sshClient.Close()

	pty, err := sshClient.NewSession()
	if err != nil {
		s.writeError("SSH", err)
		return
	}

	defer pty.Close()
	s.Pty = pty

	pty.Stdout = XtermPipe{s.TermConfig.OnStdout}
	pty.Stderr = XtermPipe{s.TermConfig.OnStdout}

	// TODO: Set Stdin func
	stdin, err := pty.StdinPipe()
	if err != nil {
		s.writeError("SSH", err)
		return
	}

	s.TermConfig.PassStdinHandler(func(input string) {
		_, err := stdin.Write([]byte(input))
		if err != nil {
			s.writeError("SSH", err)
			return
		}
	})

	rows := s.TermConfig.Rows
	if s.ResizeRows != 0 {
		rows = s.ResizeRows
	}

	cols := s.TermConfig.Cols
	if s.ResizeCols != 0 {
		cols = s.ResizeCols
	}

	err = pty.RequestPty("xterm", rows, cols, ssh.TerminalModes{})
	if err != nil {
		s.writeError("SSH", err)
		return
	}

	err = pty.Shell()
	if err != nil {
		s.writeError("SSH", err)
		return
	}

	s.TermConfig.OnConnect()
	err = pty.Wait()
	if err != nil {
		s.writeError("SSH", err)
		return
	}
}

// Resize resizes the terminal for the SSH session.
// TODO: This does NOT work correctly from Xterm.js
func (s *SSHSession) Resize(rows, cols int) error {
	// Used to handle resizes while still connecting.
	if s.Pty == nil {
		s.ResizeRows = rows
		s.ResizeCols = cols
		return nil
	}

	return s.Pty.WindowChange(rows, cols)
}

// Closes the SSH session.
func (s *SSHSession) Close() error {
	if s.Pty == nil {
		return nil
	}

	return s.Pty.Close()
}

// Quick easy formatter for writing errors to the terminal.
func (s *SSHSession) writeError(label string, err error) {
	o := fmt.Sprintf("%s error: %v\r\n", label, err)
	s.TermConfig.OnStderr(o)
}

// io.Writer "emulator" to pass to the ssh module.
type XtermPipe struct {
	// Function to call when data is written.
	Send func(data string)
}

// Write implements the io.Writer interface for XtermPipe.
func (x XtermPipe) Write(data []byte) (int, error) {
	// Tailscale's webSSH does this to fix issues in xterm.js
	res := bytes.Replace(data, []byte("\n"), []byte("\n\r"), -1)
	x.Send(string(res))
	return len(data), nil
}
