package sshutil

import (
	"io"
	"os"

	"github.com/tale/headplane/agent/internal/util"
)

// The file descriptors attached by the parent node process
const (
	InputFd  = 3
	OutputFd = 4
)

// DispatchSSHStdin listens for SSH stdin frames on the InputFd file descriptor
// and writes the payload to the appropriate session's stdin.
//
// This function runs in a goroutine in main and is responsible for dispatching
// to ALL connections, not just its own like dispatchSSHStdout does.
func DispatchSSHStdin() {
	log := util.GetLogger()

	log.Debug("Opening file descriptor: %d for SSH stdin", InputFd)
	fd := os.NewFile(InputFd, "ssh_stdin")
	if fd == nil {
		log.Error("Failed to open file descriptor %d for SSH stdin", InputFd)
		return
	}

	log.Info("Listening for SSH stdin on fd %d", InputFd)
	go func() {
		buffer := make([]byte, 8192)
		hpls1 := HPLSFrame1{}

		for {
			// This is the only check where we can detect if the descriptor
			// was closed so we can return and exit the goroutine.
			bufCount, err := fd.Read(buffer)
			if err != nil {
				log.Error("Failed to read from SSH stdin: %v", err)
				return
			}

			// Check if we have 0 EOF, which means the descriptor was closed.
			if bufCount == 0 {
				log.Info("SSH stdin closed, stopping listener")
				return
			}

			offset := 0
			for offset < bufCount {
				frame, err := hpls1.Decode(buffer[offset:bufCount])
				if err != nil {
					// We need to wait for more data to decode the frame
					break
				}

				if frame.ChannelType != ChannelTypeStdin {
					log.Error("Received invalid channel type: %d, expected %d", frame.ChannelType, ChannelTypeStdin)
					continue
				}

				offset += frame.Length()
				log.Debug("Received SSH stdin frame: %s", frame.SessionID)
				sess, ok := lookupSession(frame.SessionID)
				if !ok {
					log.Error("Invalid session ID: %s", frame.SessionID)
					continue
				}

				// Write the payload to the session's stdin
				writeCount, err := sess.Stdin.Write(frame.Payload)
				if err != nil {
					log.Error("Failed to write to session stdin: %v", err)
					continue
				}

				log.Debug("Wrote %d bytes to session %s stdin", writeCount, frame.SessionID)
			}
		}
	}()
}

func dispatchSSHStdout(id string, stdout io.Reader, stderr io.Reader) {
	log := util.GetLogger()

	log.Debug("Opening file descriptor: %d for SSH stdout", OutputFd)
	fd := os.NewFile(OutputFd, "ssh_stdout")
	if fd == nil {
		log.Error("Failed to open file descriptor %d for SSH stdout", OutputFd)
		return
	}

	go readerStreamRoutine(StreamRoutine{
		SessionID:   id,
		Reader:      stdout,
		Writer:      fd,
		ChannelType: ChannelTypeStdout,
	})

	go readerStreamRoutine(StreamRoutine{
		SessionID:   id,
		Reader:      stderr,
		Writer:      fd,
		ChannelType: ChannelTypeStderr,
	})
}

type StreamRoutine struct {
	SessionID   string
	Reader      io.Reader
	Writer      io.Writer
	ChannelType ChannelType
}

func readerStreamRoutine(routine StreamRoutine) {
	hpls1 := HPLSFrame1{}
	buf := make([]byte, 1024)
	for {
		byteCount, err := routine.Reader.Read(buf)
		if err != nil {
			if err != io.EOF {
				util.GetLogger().Error("Failed to read from reader: %v", err)
			}

			break
		}

		frame, err := hpls1.Encode(SSHFrame{
			ChannelType: routine.ChannelType,
			SessionID:   routine.SessionID,
			Payload:     buf[:byteCount],
		})

		if err != nil {
			util.GetLogger().Error("Failed to encode frame: %v", err)
			continue
		}

		if _, err := routine.Writer.Write(frame); err != nil {
			util.GetLogger().Error("Failed to write frame to writer: %v", err)
			break
		}
	}
}
