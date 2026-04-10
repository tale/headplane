//go:build js && wasm

package hp_ipn

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/netip"

	"tailscale.com/control/controlclient"
	"tailscale.com/ipn"
	"tailscale.com/ipn/ipnlocal"
	"tailscale.com/ipn/ipnserver"
	"tailscale.com/ipn/store/mem"
	"tailscale.com/net/netns"
	"tailscale.com/net/tsdial"
	"tailscale.com/safesocket"
	"tailscale.com/tsd"
	"tailscale.com/types/logid"
	"tailscale.com/wgengine"
	"tailscale.com/wgengine/netstack"
)

type TsWasmIpn struct {
	options *IPNConfig
	dialer  *tsdial.Dialer
	server  *ipnserver.Server
	backend *ipnlocal.LocalBackend
}

func NewTsWasmIpn(options *IPNConfig, callbacks *IPNCallbacks) (*TsWasmIpn, error) {
	logf := log.Printf
	netns.SetEnabled(false)

	sys := tsd.NewSystem()
	sys.Set(new(mem.Store))

	dialer := &tsdial.Dialer{Logf: logf}

	engine, err := wgengine.NewUserspaceEngine(logf, wgengine.Config{
		Dialer:        dialer,
		SetSubsystem:  sys.Set,
		ControlKnobs:  sys.ControlKnobs(),
		HealthTracker: sys.HealthTracker(),
		Metrics:       sys.UserMetricsRegistry(),
		EventBus:      sys.Bus.Get(),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create userspace engine: %w", err)
	}

	sys.Set(engine)

	tun := sys.Tun.Get()
	msock := sys.MagicSock.Get()
	dnsman := sys.DNSManager.Get()
	proxymap := sys.ProxyMapper()

	wgstack, err := netstack.Create(logf, tun, engine, msock, dialer, dnsman, proxymap)
	if err != nil {
		return nil, fmt.Errorf("failed to create netstack: %w", err)
	}

	sys.Set(wgstack)

	wgstack.ProcessLocalIPs = true
	wgstack.ProcessSubnets = true

	dialer.UseNetstackForIP = func(ip netip.Addr) bool {
		return true
	}
	dialer.NetstackDialTCP = func(ctx context.Context, dst netip.AddrPort) (net.Conn, error) {
		return wgstack.DialContextTCP(ctx, dst)
	}
	dialer.NetstackDialUDP = func(ctx context.Context, dst netip.AddrPort) (net.Conn, error) {
		return wgstack.DialContextUDP(ctx, dst)
	}

	logID := logid.PublicID{}
	sys.NetstackRouter.Set(true)
	sys.Tun.Get().Start()

	server := ipnserver.New(logf, logID, sys.NetMon.Get())

	backend, err := ipnlocal.NewLocalBackend(logf, logID, sys, controlclient.LoginEphemeral)
	if err != nil {
		return nil, fmt.Errorf("failed to create local backend: %w", err)
	}

	if err := wgstack.Start(backend); err != nil {
		return nil, fmt.Errorf("failed to start netstack: %w", err)
	}

	server.SetLocalBackend(backend)
	registerNotifyCallback(callbacks, backend)

	return &TsWasmIpn{
		options: options,
		dialer:  dialer,
		server:  server,
		backend: backend,
	}, nil
}

func (t *TsWasmIpn) Start(ctx context.Context) error {
	listener, err := safesocket.Listen("")
	if err != nil {
		return fmt.Errorf("failed to create safesocket listener: %w", err)
	}

	go func() {
		if err := t.server.Run(ctx, listener); err != nil {
			log.Printf("Tailscale server exited: %v", err)
		}
	}()

	err = t.backend.Start(ipn.Options{
		AuthKey: t.options.PreAuthKey,
		UpdatePrefs: &ipn.Prefs{
			ControlURL:   t.options.ControlURL,
			Hostname:     t.options.Hostname,
			WantRunning:  true,
			RunWebClient: false,
			LoggedOut:    false,
		},
	})
	if err != nil {
		return fmt.Errorf("failed to start Tailscale backend: %w", err)
	}

	return nil
}
