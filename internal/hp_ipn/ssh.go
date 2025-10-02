//go:build js && wasm

package hp_ipn

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"syscall/js"
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

	// Reference to our stdin handler, released on close.
	stdinHandler *js.Func
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

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(s.TermConfig.Timeout)*time.Second)
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

	rows := s.TermConfig.Rows
	if s.ResizeRows != 0 {
		rows = s.ResizeRows
	}

	cols := s.TermConfig.Cols
	if s.ResizeCols != 0 {
		cols = s.ResizeCols
	}

	err = pty.RequestPty("xterm", rows, cols, ssh.TerminalModes{
		ssh.ECHO:          1,     // enable echoing
		ssh.ICANON:        1,     // canonical mode
		ssh.ISIG:          1,     // enable signals
		ssh.ICRNL:         1,     // map CR to NL on input
		ssh.IUTF8:         1,     // input is UTF-8
		ssh.TTY_OP_ISPEED: 14400, // input speed = 14.4kbaud
		ssh.TTY_OP_OSPEED: 14400, // output speed = 14.4kbaud
	})

	if err != nil {
		s.writeError("SSH", err)
		return
	}

	stdin, err := pty.StdinPipe()
	if err != nil {
		s.writeError("SSH", err)
		return
	}

	s.wireStdinHandler(stdin)

	stdout, err := pty.StdoutPipe()
	if err != nil {
		s.writeError("SSH", err)
		return
	}

	stderr, err := pty.StderrPipe()
	if err != nil {
		s.writeError("SSH", err)
		return
	}

	go io.Copy(XtermPipe{s.TermConfig.OnStdout}, stdout)
	go io.Copy(XtermPipe{s.TermConfig.OnStderr}, stderr)

	// Create our shell
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

	return s.Pty.WindowChange(cols, rows)
}

// Closes the SSH session.
func (s *SSHSession) Close() error {
	if s.stdinHandler != nil {
		s.stdinHandler.Release()
		s.stdinHandler = nil
	}

	if s.Pty != nil {
		err := s.Pty.Close()
		if err != nil {
			return err
		}
	}

	return nil
}

// Wires up the stdin handler to pass data from JS to the SSH session.
func (s *SSHSession) wireStdinHandler(w io.Writer) {
	if s.stdinHandler != nil {
		s.stdinHandler.Release()
		s.stdinHandler = nil
	}

	cb := js.FuncOf(func(this js.Value, args []js.Value) any {
		v := args[0] // This is ALWAYS a Uint8Array technically
		len := v.Get("byteLength").Int()
		buf := make([]byte, len)
		js.CopyBytesToGo(buf, v)

		if _, err := w.Write(buf); err != nil {
			s.writeError("SSH Stdin", err)
			return nil
		}

		// TODO: Remove debug log
		log.Printf("SSH wrote %d bytes: %v (%q)", len, buf, string(buf))
		return nil
	})

	s.stdinHandler = &cb
	s.TermConfig.OnStdin.Invoke(cb)
}

// Quick easy formatter for writing errors to the terminal.
func (s *SSHSession) writeError(label string, err error) {
	o := fmt.Sprintf("%s error: %v\r\n", label, err)
	uint8Array := js.Global().Get("Uint8Array").New(len(o))

	js.CopyBytesToJS(uint8Array, []byte(o))
	s.TermConfig.OnStderr(uint8Array)
}

// io.Writer "emulator" to pass to the ssh module.
type XtermPipe struct {
	// Function to call when data is written.
	Send func(data js.Value)
}

// Write implements the io.Writer interface for XtermPipe.
func (x XtermPipe) Write(data []byte) (int, error) {
	uint8Array := js.Global().Get("Uint8Array").New(len(data))
	js.CopyBytesToJS(uint8Array, data)
	x.Send(uint8Array)
	return len(data), nil
}
