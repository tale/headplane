package sshutil

import (
	"encoding/binary"
	"fmt"
)

func encodeFrame(id string, data []byte) ([]byte, error) {
	sid := []byte(id)
	if len(sid) > 255 {
		return nil, fmt.Errorf("session ID too long")
	}

	payloadLen := len(data)
	buf := make([]byte, 1+len(sid)+4+payloadLen)

	buf[0] = byte(len(sid))                                          // SID length
	copy(buf[1:], sid)                                               // SID
	binary.BigEndian.PutUint32(buf[1+len(sid):], uint32(payloadLen)) // Payload length
	copy(buf[1+len(sid)+4:], data)                                   // Payload

	return buf, nil
}

func decodeFrame(buf []byte) (id string, payload []byte, ok bool) {
	if len(buf) < 5 {
		return "", nil, false
	}
	sidLen := int(buf[0])
	if len(buf) < 1+sidLen+4 {
		return "", nil, false
	}
	id = string(buf[1 : 1+sidLen])
	payloadLen := int(binary.BigEndian.Uint32(buf[1+sidLen:]))

	if len(buf) < 1+sidLen+4+payloadLen {
		return "", nil, false
	}
	payload = buf[1+sidLen+4 : 1+sidLen+4+payloadLen]
	return id, payload, true
}
