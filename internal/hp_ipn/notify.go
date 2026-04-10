//go:build js && wasm

package hp_ipn

import (
	"context"
	"fmt"
	"log"
	"sync"

	"tailscale.com/ipn"
	"tailscale.com/ipn/ipnlocal"
)

func registerNotifyCallback(callbacks *IPNCallbacks, lb *ipnlocal.LocalBackend) {
	var readyOnce sync.Once

	lb.SetNotifyCallback(func(n ipn.Notify) {
		defer func() {
			if rec := recover(); rec != nil {
				callbacks.OnError(fmt.Sprint(rec))
			}
		}()

		if n.State != nil {
			if *n.State == ipn.Running {
				readyOnce.Do(callbacks.OnReady)
			}

			if *n.State == ipn.NeedsLogin {
				go forceInteractiveLogin(lb)
			}
		}
	})
}

func forceInteractiveLogin(lb *ipnlocal.LocalBackend) {
	if err := lb.StartLoginInteractive(context.Background()); err != nil {
		log.Printf("Error starting interactive login: %v", err)
	}
}
