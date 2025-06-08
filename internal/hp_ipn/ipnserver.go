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
	"tailscale.com/net/netmon"
	"tailscale.com/net/netns"
	"tailscale.com/net/tsdial"
	"tailscale.com/safesocket"
	"tailscale.com/tsd"
	"tailscale.com/types/logid"
	"tailscale.com/wgengine"
	"tailscale.com/wgengine/netstack"
)

// Represents an in-state Tailscale backend that is WASM friendly.
// The bare minimum to have userspace Wireguard networking is a dialer,
// a server, and a backend.
type TsWasmIpn struct {
	// The options used to initialize the TsWasmNet module.
	options *TsWasmNetOptions

	// The Tailscale dialer, which is used to establish connections.
	dialer *tsdial.Dialer

	// The Tailscale server, which handles incoming connections and requests.
	server *ipnserver.Server

	// The Tailscale backend, which manages the local state and operations.
	backend *ipnlocal.LocalBackend
}

// NewTsWasmIpn initializes a new TsWasmIpn instance with the provided options.
// This intentionally does not initialize Logtail, as it is only available in
// the Tailscale SaaS and not on self-hosted instances.
func NewTsWasmIpn(options *TsWasmNetOptions, callbacks *TsWasmNetCallbacks) (*TsWasmIpn, error) {
	logf := log.Printf // TODO: Update

	netns.SetEnabled(false) // netns is a separate process (not WASM friendly)

	// Base system (NewSystem() creates a bus automatically)
	// We supply an in-memory store
	sys := tsd.NewSystem()
	bus := sys.Bus.Get()
	sys.Set(new(mem.Store))

	dialer := &tsdial.Dialer{Logf: logf}
	netmon, err := netmon.New(bus, logf)
	if err != nil {
		return nil, err
	}

	// Userspace Wireguard engine
	engine, err := wgengine.NewUserspaceEngine(logf, wgengine.Config{
		Dialer:        dialer,
		NetMon:        netmon,
		SetSubsystem:  sys.Set,
		ControlKnobs:  sys.ControlKnobs(),
		HealthTracker: sys.HealthTracker(),
		Metrics:       sys.UserMetricsRegistry(),
	})

	sys.Set(engine)
	if err != nil {
		return nil, err
	}

	tun := sys.Tun.Get()
	msock := sys.MagicSock.Get()
	dnsman := sys.DNSManager.Get()
	proxymap := sys.ProxyMapper()
	wgstack, err := netstack.Create(logf, tun, engine, msock, dialer, dnsman, proxymap)

	sys.Set(wgstack)
	if err != nil {
		return nil, err
	}

	// Configure the local Netstack and Dialer
	wgstack.ProcessLocalIPs = true
	wgstack.ProcessSubnets = true
	sys.NetstackRouter.Set(true)

	dialer.UseNetstackForIP = func(ip netip.Addr) bool {
		return true
	}

	dialer.NetstackDialTCP = func(ctx context.Context, dst netip.AddrPort) (net.Conn, error) {
		return wgstack.DialContextTCP(ctx, dst)
	}

	dialer.NetstackDialUDP = func(ctx context.Context, dst netip.AddrPort) (net.Conn, error) {
		return wgstack.DialContextUDP(ctx, dst)
	}

	// Dummy logid for the Tailscale backend
	logid := logid.PublicID{}
	tun.Start()

	server := ipnserver.New(logf, logid, sys.NetMon.Get())
	flags := controlclient.LoginDefault | controlclient.LoginEphemeral | controlclient.LocalBackendStartKeyOSNeutral

	backend, err := ipnlocal.NewLocalBackend(logf, logid, sys, flags)
	if err != nil {
		return nil, err
	}

	err = wgstack.Start(backend)
	if err != nil {
		return nil, err
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

// Starts the WASM backend which will connect to the Tailscale tailnet and
// register an ephemeral node viewable in the Tailscale admin console.
func (t *TsWasmIpn) Start(ctx context.Context) error {
	// Blank "socket" is a requirement for WASM
	// This NEEDS to happen before the LocalBackend is started,
	listener, err := safesocket.Listen("")
	if err != nil {
		return fmt.Errorf("failed to create safesocket listener: %w", err)
	}

	// Start the server BEFORE the LocalBackend is started
	go func() {
		err := t.server.Run(ctx, listener)
		if err != nil {
			// TODO: Handle this dispatch using a chan
			log.Printf("Failed to run Tailscale server: %v", err)
		}
	}()

	// Start the LocalBackend
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

	log.Printf("Tailscale backend started successfully with hostname: %s", t.options.Hostname)
	return nil
}
