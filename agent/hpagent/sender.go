package hpagent

import (
	"tailscale.com/tailcfg"
)

// Sends the status to the Headplane master
func (s *Socket) SendStatus(status map[string]*tailcfg.HostinfoView) error {
	err := s.WriteJSON(status)
	return err
}
