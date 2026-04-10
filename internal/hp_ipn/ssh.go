//go:build js && wasm

package hp_ipn

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"time"

	"golang.org/x/crypto/ssh"
)

type SSHSession struct {
	IPAddress string
	Username  string
	Config    *TunnelConfig
	Ipn       *TsWasmIpn
	Pty       *ssh.Session

	stdin      io.Writer
	resizeCols int
	resizeRows int
	cancel     context.CancelFunc
}

func (i *TsWasmIpn) NewSSHSession(config *TunnelConfig) *SSHSession {
	return &SSHSession{
		IPAddress: config.IPAddress,
		Username:  config.Username,
		Config:    config,
		Ipn:       i,
	}
}

func (s *SSHSession) ConnectAndRun() {
	defer s.Config.OnDisconnect()

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(s.Config.Timeout)*time.Second)
	s.cancel = cancel
	defer cancel()

	conn, err := s.Ipn.dialer.UserDial(ctx, "tcp", net.JoinHostPort(s.IPAddress, "22"))
	if err != nil {
		s.writeError("Dial", err)
		return
	}
	defer conn.Close()

	// In Go WASM, gVisor's netstack conn.Read blocks indefinitely without
	// a deadline because the single-threaded goroutine scheduler needs the
	// deadline machinery to yield to the browser event loop and process
	// inbound WireGuard packets. We set a deadline that covers the entire
	// SSH handshake and clear it once the session is established.
	conn.SetReadDeadline(time.Now().Add(30 * time.Second))

	sshConf := &ssh.ClientConfig{
		User: s.Username,
		HostKeyCallback: func(hostname string, remote net.Addr, key ssh.PublicKey) error {
			return nil
		},
	}

	sshConn, chans, reqs, err := ssh.NewClientConn(conn, s.IPAddress, sshConf)
	if err != nil {
		s.writeError("SSH", err)
		return
	}
	defer sshConn.Close()

	conn.SetReadDeadline(time.Time{})

	sshClient := ssh.NewClient(sshConn, chans, reqs)
	defer sshClient.Close()

	pty, err := sshClient.NewSession()
	if err != nil {
		s.writeError("SSH", err)
		return
	}
	defer pty.Close()
	s.Pty = pty

	rows := 24
	if s.resizeRows != 0 {
		rows = s.resizeRows
	}

	cols := 80
	if s.resizeCols != 0 {
		cols = s.resizeCols
	}

	err = pty.RequestPty("xterm-256color", rows, cols, ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.ICANON:        1,
		ssh.ISIG:          1,
		ssh.ICRNL:         1,
		ssh.IUTF8:         1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
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
	s.stdin = stdin

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

	go io.Copy(DataPipe{s.Config.OnData}, stdout)
	go io.Copy(DataPipe{s.Config.OnData}, stderr)

	err = pty.Shell()
	if err != nil {
		s.writeError("SSH", err)
		return
	}

	s.Config.OnConnect()
	if err := pty.Wait(); err != nil {
		log.Printf("SSH session ended: %v", err)
	}
}

func (s *SSHSession) WriteInput(data string) {
	if s.stdin != nil {
		s.stdin.Write([]byte(data))
	}
}

// Resize takes cols and rows (JS convention: cols first, rows second)
// and translates to SSH's WindowChange(rows, cols) order.
func (s *SSHSession) Resize(cols, rows int) error {
	if s.Pty == nil {
		s.resizeCols = cols
		s.resizeRows = rows
		return nil
	}

	return s.Pty.WindowChange(rows, cols)
}

func (s *SSHSession) Close() error {
	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
	}

	if s.Pty != nil {
		return s.Pty.Close()
	}

	return nil
}

func (s *SSHSession) writeError(label string, err error) {
	s.Config.OnData(fmt.Sprintf("%s error: %v\r\n", label, err))
}

type DataPipe struct {
	Send func(data string)
}

func (p DataPipe) Write(data []byte) (int, error) {
	p.Send(string(data))
	return len(data), nil
}
