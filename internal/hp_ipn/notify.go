//go:build js && wasm

package hp_ipn

import (
	"context"
	"fmt"
	"log"

	"tailscale.com/ipn"
	"tailscale.com/ipn/ipnlocal"
)

func registerNotifyCallback(callbacks *TsWasmNetCallbacks, lb *ipnlocal.LocalBackend) {
	lb.SetNotifyCallback(func(n ipn.Notify) {
		// Panics should be treated with care in a JS/wasm environment.
		// If a panic occurs, notify the user and either automatically reload
		// or give the option to reload.

		defer func() {
			rec := recover()
			if rec != nil {
				callbacks.NotifyPanicRecover(fmt.Sprint(rec))
			}
		}()

		if n.State != nil {
			callbacks.NotifyState(*n.State)

			if *n.State == ipn.NeedsLogin {
				// If the state is NeedsLogin, we need to force an interactive login.
				go forceInteractiveLogin(lb)
			}
		}

		if n.BrowseToURL != nil {
			callbacks.NotifyBrowseToURL(*n.BrowseToURL)
		}

		if n.NetMap != nil {
			callbacks.NotifyNetMap(n.NetMap)
		}

		log.Printf("NOTIFY: %+v", n)

		// if nm := n.NetMap; nm != nil {
		// 	jsNetMap := jsNetMap{
		// 		Self: jsNetMapSelfNode{
		// 			jsNetMapNode: jsNetMapNode{
		// 				Name:       nm.Name,
		// 				Addresses:  mapSliceView(nm.GetAddresses(), func(a netip.Prefix) string { return a.Addr().String() }),
		// 				NodeKey:    nm.NodeKey.String(),
		// 				MachineKey: nm.MachineKey.String(),
		// 			},
		// 			MachineStatus: jsMachineStatus[nm.GetMachineStatus()],
		// 		},
		// 		Peers: mapSlice(nm.Peers, func(p tailcfg.NodeView) jsNetMapPeerNode {
		// 			name := p.Name()
		// 			if name == "" {
		// 				// In practice this should only happen for Hello.
		// 				name = p.Hostinfo().Hostname()
		// 			}
		// 			addrs := make([]string, p.Addresses().Len())
		// 			for i, ap := range p.Addresses().All() {
		// 				addrs[i] = ap.Addr().String()
		// 			}
		// 			return jsNetMapPeerNode{
		// 				jsNetMapNode: jsNetMapNode{
		// 					Name:       name,
		// 					Addresses:  addrs,
		// 					MachineKey: p.Machine().String(),
		// 					NodeKey:    p.Key().String(),
		// 				},
		// 				Online:              p.Online().Clone(),
		// 				TailscaleSSHEnabled: p.Hostinfo().TailscaleSSHEnabled(),
		// 			}
		// 		}),
		// 		LockedOut: nm.TKAEnabled && nm.SelfNode.KeySignature().Len() == 0,
		// 	}
		// 	if jsonNetMap, err := json.Marshal(jsNetMap); err == nil {
		// 		jsCallbacks.Call("notifyNetMap", string(jsonNetMap))
		// 	} else {
		// 		log.Printf("Could not generate JSON netmap: %v", err)
		// 	}
		// }
		// if n.BrowseToURL != nil {
		// 	jsCallbacks.Call("notifyBrowseToURL", *n.BrowseToURL)
		// }
	})
}

// To get auth to work, even with a pre-auth key, we need to
// force an interactive login on the NeedsLogin state.
func forceInteractiveLogin(lb *ipnlocal.LocalBackend) {
	err := lb.StartLoginInteractive(context.Background())
	if err != nil {
		fmt.Printf("Error starting interactive login: %v\n", err)
	}
}
