//go:build js && wasm

package hp_ipn

import (
	"errors"
	"fmt"
	"syscall/js"

	"tailscale.com/ipn"
	"tailscale.com/types/netmap"
)

// Maps ipn.State values to their string representations for the frontend.
var BackendState = map[ipn.State]string{
	ipn.NoState:          "NoState",
	ipn.Stopped:          "Stopped",
	ipn.Starting:         "Starting",
	ipn.Running:          "Running",
	ipn.InUseOtherUser:   "InUseOtherUser",
	ipn.NeedsMachineAuth: "NeedsMachineAuth",
	ipn.NeedsLogin:       "NeedsLogin",
}

// Represents the callbacks that the TsWasmNet module can invoke to register
// data retrieval and notifications on the frontend.
type TsWasmNetCallbacks struct {
	// Changes in the backend state.
	NotifyState func(ipn.State)

	// Updates to the backend's network map.
	NotifyNetMap func(*netmap.NetworkMap)

	// If interactive login is required, this passes a login URL.
	NotifyBrowseToURL func(string)

	// If the process panics, this function is called in go.recover.
	NotifyPanicRecover func(string)
}

// Parses a JavaScript object containing the necessary callbacks for the
// TsWasmNet module to properly interact with the frontend.
func ParseTsWasmNetCallbacks(obj js.Value) (*TsWasmNetCallbacks, error) {
	if obj.IsUndefined() || obj.IsNull() {
		return nil, errors.New("callbacks object is undefined or null")
	}

	state, err := validateCallback("NotifyState", obj)
	if err != nil {
		return nil, fmt.Errorf("invalid callback NotifyState: %w", err)
	}

	// TODO: This is complicated, as the NetworkMap is a complex type.
	_, err = validateCallback("NotifyNetMap", obj)
	if err != nil {
		return nil, fmt.Errorf("invalid callback NotifyNetMap: %w", err)
	}

	browseURL, err := validateCallback("NotifyBrowseToURL", obj)
	if err != nil {
		return nil, fmt.Errorf("invalid callback NotifyBrowseToURL: %w", err)
	}

	panicRecover, err := validateCallback("NotifyPanicRecover", obj)
	if err != nil {
		return nil, fmt.Errorf("invalid callback NotifyPanicRecover: %w", err)
	}

	return &TsWasmNetCallbacks{
		NotifyState: func(ipnState ipn.State) {
			state.Invoke(BackendState[ipnState])
		},

		NotifyNetMap: func(nm *netmap.NetworkMap) {
			// We need to build a JSON representation of the NetworkMap
			// For now we just pass the NodeKey since that's what we need.
			jsObj := js.ValueOf(map[string]any{
				"NodeKey": nm.NodeKey.String(),
			})

			obj.Get("NotifyNetMap").Invoke(jsObj)
		},

		NotifyBrowseToURL: func(url string) {
			browseURL.Invoke(url)
		},

		NotifyPanicRecover: func(msg string) {
			panicRecover.Invoke(msg)
		},
	}, nil
}

// Validates the specified key is a JS function and returns it.
func validateCallback(key string, obj js.Value) (*js.Value, error) {
	val := obj.Get(key)
	if val.IsUndefined() || val.IsNull() {
		return nil, errors.New("callback is undefined or null")
	}

	if val.Type() != js.TypeFunction {
		return nil, errors.New("callback is not a function")
	}

	return &val, nil
}
