package sshutil

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/tale/headplane/agent/internal/tsnet"
	"github.com/tale/headplane/agent/internal/util"
	"golang.org/x/crypto/ssh"
)

type SSHConnectPayload struct {
	SessionId string `cbor:"sessionId"`
	Username  string `cbor:"username"`
	Hostname  string `cbor:"hostname"`
	Port      int    `cbor:"port"`
}

type SSHClosePayload struct {
	SessionId string `cbor:"sessionId"`
}

func connectToTailscaleSSH(agent *tsnet.TSAgent, params SSHConnectPayload) (*ssh.Client, error) {
	log := util.GetLogger()
	addr := strings.Join([]string{params.Hostname, ":", strconv.Itoa(params.Port)}, "")

	log.Debug("Initiating Tailscale SSH connection to %s@%s", params.Username, addr)
	tailnetConn, err := agent.Dial(context.Background(), "tcp", addr)
	if err != nil {
		return nil, err
	}

	log.Debug("Routed connection via tsnet to %s", addr)
	config := &ssh.ClientConfig{
		User: params.Username,
		// This isn't a concern because we are only dialing within the Tailnet
		// and every device is trusted and *should* be ACL accessible.
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	}

	conn, chans, reqs, err := ssh.NewClientConn(tailnetConn, addr, config)
	if err != nil {
		conn.Close()
		return nil, err
	}

	// At this point we have successfully connected to the node
	sshClient := ssh.NewClient(conn, chans, reqs)
	version := string(sshClient.ServerVersion())

	if !strings.Contains(version, "Tailscale") {
		conn.Close()
		return nil, errors.New("server is not running Tailscale SSH")
	}

	log.Info("Connected to %s@%s:%d via Tailscale SSH (%s)", params.Username, params.Hostname, params.Port, version)
	return sshClient, nil
}

func StartWebSSH(agent *tsnet.TSAgent, params SSHConnectPayload) {
	log := util.GetLogger()

	if agent == nil {
		log.Error("tsnet.TSAgent is not initialized correctly")
		return
	}

	if params.Hostname == "" || params.Port <= 0 || params.Username == "" || params.SessionId == "" {
		log.Error("Invalid SSH connection parameters: %v", params)
		return
	}

	client, err := connectToTailscaleSSH(agent, params)
	if err != nil {
		log.Error("Failed to connect to Tailscale SSH for (%s): %s", params.SessionId, err)
		return
	}

	// Everything in the func is related to the SSH session.
	// Each session runs in its own goroutine, allowing concurrency.
	go func() {
		log.Debug("Creating SSH session for session ID: %s", params.SessionId)
		sess, err := client.NewSession()
		if err != nil {
			log.Error("Failed to create new SSH session: %s", err)
			client.Close()
			return
		}

		modes := ssh.TerminalModes{
			ssh.ECHO:          1,
			ssh.TTY_OP_ISPEED: 14400,
			ssh.TTY_OP_OSPEED: 14400,
		}

		// Resize event is possible via the control channel later
		err = sess.RequestPty("xterm-256color", 80, 40, modes)
		if err != nil {
			log.Error("Failed to request PTY for (%s): %s", params.SessionId, err)
			return
		}

		ctx, err := registerSessionChans(params.SessionId, sess)
		if err != nil {
			log.Error("Failed to register session channels for (%s): %s", params.SessionId, err)
			client.Close()
			return
		}

		// Input buffer handler
		go func() {
			for data := range ctx.InputCh {
				_, err := ctx.Stdin.Write(data)
				if err != nil {
					log.Error("Failed to write to SSH stdin: %s", err)
					return
				}
			}
		}()

		// Spin up a shell and wait for the pty to terminate
		err = sess.Shell()
		if err != nil {
			log.Error("Failed to start shell for (%s): %s", params.SessionId, err)
			client.Close()
			return
		}

		// This spawns 2 goroutins for stdout and stderr
		dispatchSSHStdout(params.SessionId, ctx.Stdout, ctx.Stderr)

		log.Info("Opened an SSH PTY for %s", params.SessionId)
		sess.Wait()
		sess.Close()
		client.Close()

		log.Info("SSH session for %s closed", params.SessionId)
		RemoveSession(params.SessionId)
	}()
}

func CloseWebSSH(agent *tsnet.TSAgent, params SSHClosePayload) {
	log := util.GetLogger()

	if agent == nil {
		log.Error("tsnet.TSAgent is not initialized correctly")
		return
	}

	if params.SessionId == "" {
		log.Error("Invalid SSH close parameters: %v", params)
		return
	}

	log.Debug("Closing SSH session for session ID: %s", params.SessionId)
	ctx, ok := lookupSession(params.SessionId)
	if !ok {
		log.Info("No active SSH session found for session ID: %s", params.SessionId)
		return
	}

	RemoveSession(ctx.ID)
	log.Info("SSH session for %s closed", params.SessionId)
}
