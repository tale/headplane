package sshutil

import (
	"io"

	"github.com/tale/headplane/agent/internal/util"
)

func StartInputReader(fd3 io.Reader) {
	log := util.GetLogger();

	log.Info("Starting SSH fd3 input reader")
	go func() {
		buffer := make([]byte, 8192)
		for {
			n, err := fd3.Read(buffer)
			if err != nil {
				log.Error("fd3 read error: %v", err)
				return
			}
			offset := 0
			for offset < n {
				id, payload, ok := decodeFrame(buffer[offset:n])
				if !ok {
					break // Wait for more data
				}
				offset += 1 + len(id) + 4 + len(payload)

				sessionsMu.RLock()
				sess, ok := sessions[id]
				sessionsMu.RUnlock()
				if !ok {
					log.Error("invalid session id: %s", id)
					continue
				}
				_, err := sess.Stdin.Write(payload)
				if err != nil {
					log.Error("failed to write to session stdin: %v", err)
					continue
				}
			}
		}
	}()
}

func streamSSHOutput(id string, r io.Reader, fd4 io.Writer) {
	buf := make([]byte, 1024)
	for {
		n, err := r.Read(buf)
		if err != nil {
			break
		}
		frame, _ := encodeFrame(id, buf[:n])
		fd4.Write(frame)
	}
}
