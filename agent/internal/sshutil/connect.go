package sshutil

import (
	"context"
	"errors"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/tale/headplane/agent/internal/tsnet"
	"github.com/tale/headplane/agent/internal/util"
	"golang.org/x/crypto/ssh"
)

type SshConnectParams struct {
	Hostname string
	Port     int
	Username string
	Id 	 string
}

func dialAndValidateTailscaleSSH(agent *tsnet.TSAgent, params SshConnectParams) (*ssh.Client, error) {
	log := util.GetLogger()

	addr := strings.Join([]string{params.Hostname, ":", strconv.Itoa(params.Port)}, "")

	log.Debug("Attempting to dial %s via Tailscale SSH", addr)
	conn, err := agent.Dial(context.Background(), "tcp", addr)
	if err != nil {
		log.Error("Failed to connect to Tailscale SSH: %s", err)
		return nil, err
	}

	log.Debug("Connected to Tailscale SSH at %s", addr)
	config := &ssh.ClientConfig{
		User: params.Username,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	}

	clientConn, chans, reqs, err := ssh.NewClientConn(conn, addr, config)
	if err != nil {
		log.Error("Failed to create SSH client connection: %s", err)
		conn.Close()
		return nil, err
	}

	client := ssh.NewClient(clientConn, chans, reqs)
	sVer := string(client.ServerVersion())

	if !strings.Contains(sVer, "Tailscale") {
		log.Error("Connected to non-Tailscale SSH server: %s", sVer)
		conn.Close()
		return nil, errors.New("not a Tailscale SSH server")
	}

	log.Info("Connected to SSH server running %s at %s", client.ServerVersion(), addr)
	return client, nil
}

func bindStdinToFd(sess *ssh.Session, fd int) error {
	log := util.GetLogger()

	sshIn := os.NewFile(uintptr(fd), "sshInput")
	if sshIn == nil {
		log.Error("Failed to create file from stdin fd %d", fd)
		return errors.New("failed to create file from stdin fd")
	}

	stdin, err := sess.StdinPipe()
	if err != nil {
		log.Error("Failed to get stdin pipe: %s", err)
		return err
	}

	go io.Copy(stdin, sshIn) // From Node → SSH session
	return nil
}

func bindStdoutToFd(sess *ssh.Session, fd int) error {
	log := util.GetLogger()

	sshOut := os.NewFile(uintptr(fd), "sshOutput")
	if sshOut == nil {
		log.Error("Failed to create file from stdout fd %d", fd)
		return errors.New("failed to create file from stdout fd")
	}

	stdout, err := sess.StdoutPipe()
	if err != nil {
		log.Error("Failed to get stdout pipe: %s", err)
		return err
	}

	go io.Copy(sshOut, stdout) // From SSH → Node
	return nil
}

func OpenSshPty(agent *tsnet.TSAgent, params SshConnectParams) (*ssh.Client, error) {
	log := util.GetLogger()

	if agent == nil {
		log.Error("Tailscale agent is nil")
		return nil, errors.New("tailscale agent is nil")
	}

	if params.Hostname == "" || params.Port <= 0 || params.Username == "" {
		log.Error("Invalid SSH connection parameters: %+v", params)
		return nil, errors.New("invalid SSH connection parameters")
	}

	client, err := dialAndValidateTailscaleSSH(agent, params)
	if err != nil {
		log.Error("Failed to open SSH pty: %s", err)
		return nil, err
	}

	go func() {
	sess, err := client.NewSession()
	if err != nil {
		log.Error("Failed to create new SSH session: %s", err)
		client.Close()
	}

	modes := ssh.TerminalModes{
		ssh.ECHO:          1, // enable echoing
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}

	if err := sess.RequestPty("xterm-256color", 80, 40, modes); err != nil {
		log.Error("Failed to request PTY: %s", err)
		client.Close()
	}

	ctx := addSession(params.Id, sess)
	go func() {
		for data := range ctx.InputCh {
			if _, err := ctx.Stdin.Write(data); err != nil {
				log.Error("Failed to write to SSH stdin: %s", err)
				return
			}
		}
	}();

	if err := sess.Shell(); err != nil {
		log.Error("Failed to start shell: %s", err)
		client.Close()
	}


	log.Info("Successfully opened SSH pty for %s@%s:%d", params.Username, params.Hostname, params.Port)
	go streamSSHOutput(params.Id, ctx.Stdout, os.NewFile(4, "sshOutput"))
		sess.Wait();
		sess.Close();
		log.Info("SSH session %s closed (goSide)", params.Id)
		RemoveSession(params.Id)
	}()

	return client, nil
}
