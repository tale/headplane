package sshutil

import (
	"encoding/binary"
	"fmt"
)

// An SSH frame is used to wrap raw binary data to and from an SSH session
// in order to allow multiplexing connections over a single file descriptor.
//
// In practice, this is how we can easily support multiple SSH connections
// through the 2 file descriptors created by the parent node process.
//
// This is the format of an SSH frame:
// - Magic: The first 4 bytes are HPLS (0x48504C53) to identify the frame.
// - Version Byte: The first byte is the version of the frame format.
// - Channel Type: The second byte indicates the type of channel.
// - Session ID: The next bytes are the length and actual session ID.
// - Payload: The remaining bytes are the payload length and actual data.
//
// +---------+----------+--------------+-------------+----------+
// | Magic   | Version  | Channel Type | SID Length  | SID      |
// | 4 bytes | 1 byte   | 1 byte       | 1 byte (S)  | S bytes  |
// +---------+----------+--------------+------------------------+
// | Payload Length     | Payload                               |
// | 4 bytes (u32, P)   | P bytes                               |
// +--------------------+---------------------------------------+

const (
	MagicString = "HPLS"
	VersionByte = 1
)

type ChannelType int

const (
	ChannelTypeStdin ChannelType = iota
	ChannelTypeStdout
	ChannelTypeStderr
)

type SSHFrame struct {
	ChannelType ChannelType
	SessionID   string
	Payload     []byte

	Length func() int
}

type HPLSFrame1 struct{}

func (t HPLSFrame1) Encode(frame SSHFrame) ([]byte, error) {
	frameChan := frame.ChannelType
	switch frameChan {
	case ChannelTypeStdin, ChannelTypeStdout, ChannelTypeStderr:
	default:
		return nil, fmt.Errorf("invalid channel type: %d", frameChan)
	}

	if len(frame.SessionID) == 0 {
		return nil, fmt.Errorf("session ID cannot be empty")
	}

	if len(frame.Payload) == 0 {
		return nil, fmt.Errorf("payload cannot be empty")
	}

	sid := []byte(frame.SessionID)
	if len(sid) > 255 {
		return nil, fmt.Errorf("session ID exceeds 255 byte limit")
	}

	if len(frame.Payload) > 0xFFFFFFFF {
		return nil, fmt.Errorf("payload exceeds 4GB limit")
	}

	frameLen := 4                      // Magic
	frameLen += 1                      // Version byte
	frameLen += 1                      // Channel type
	frameLen += 1 + len(sid)           // Session ID length + SID
	frameLen += 4 + len(frame.Payload) // Payload length + Payload

	buf := make([]byte, frameLen)
	copy(buf[0:4], []byte(MagicString))
	buf[4] = VersionByte
	buf[5] = byte(frameChan)
	buf[6] = byte(len(sid))

	offset := 7 + len(sid)
	copy(buf[7:offset], sid)

	binary.BigEndian.PutUint32(buf[offset:offset+4], uint32(len(frame.Payload)))
	copy(buf[offset+4:], frame.Payload)
	return buf, nil
}

func (t HPLSFrame1) Decode(buf []byte) (SSHFrame, error) {
	frame := SSHFrame{}
	if len(buf) < 5 || string(buf[0:4]) != MagicString || buf[4] != VersionByte {
		return frame, fmt.Errorf("illegal HPLS1 frame format")
	}

	frame.ChannelType = ChannelType(buf[5])
	if frame.ChannelType < ChannelTypeStdin || frame.ChannelType > ChannelTypeStderr {
		return frame, fmt.Errorf("invalid channel type: %d", frame.ChannelType)
	}

	sidLen := int(buf[6])
	if len(buf) < 7+sidLen+4 {
		return frame, fmt.Errorf("buffer too short for session ID and payload length")
	}

	frame.SessionID = string(buf[7 : 7+sidLen])
	payloadLen := int(binary.BigEndian.Uint32(buf[7+sidLen:]))
	if len(buf) < 7+sidLen+4+payloadLen {
		return frame, fmt.Errorf("buffer too short for payload")
	}

	frame.Payload = buf[7+sidLen+4 : 7+sidLen+4+payloadLen]
	frame.Length = func() int {
		return 7 + sidLen + 4 + payloadLen
	}

	return frame, nil
}
