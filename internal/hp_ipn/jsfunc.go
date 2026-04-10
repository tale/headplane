//go:build js && wasm

package hp_ipn

import (
	"syscall/js"

	"tailscale.com/ipn"
)

type IPNCallbacks struct {
	OnReady func()
	OnError func(string)
}

func ParseIPNCallbacks(obj js.Value) *IPNCallbacks {
	cb := &IPNCallbacks{
		OnReady: func() {},
		OnError: func(string) {},
	}

	onReady := obj.Get("onReady")
	if onReady.Type() == js.TypeFunction {
		cb.OnReady = func() { onReady.Invoke() }
	}

	onError := obj.Get("onError")
	if onError.Type() == js.TypeFunction {
		cb.OnError = func(msg string) { onError.Invoke(msg) }
	}

	return cb
}

var BackendState = map[ipn.State]string{
	ipn.NoState:          "NoState",
	ipn.Stopped:          "Stopped",
	ipn.Starting:         "Starting",
	ipn.Running:          "Running",
	ipn.InUseOtherUser:   "InUseOtherUser",
	ipn.NeedsMachineAuth: "NeedsMachineAuth",
	ipn.NeedsLogin:       "NeedsLogin",
}
