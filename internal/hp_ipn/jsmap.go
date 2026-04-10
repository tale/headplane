//go:build js && wasm

package hp_ipn

import (
	"errors"
	"syscall/js"
)

type IPNConfig struct {
	ControlURL string
	PreAuthKey string
	Hostname   string
}

func ParseIPNConfig(obj js.Value) (*IPNConfig, error) {
	if obj.IsUndefined() || obj.IsNull() {
		return nil, errors.New("config cannot be undefined or null")
	}

	controlURL := safeString("controlURL", obj)
	preAuthKey := safeString("preAuthKey", obj)
	hostname := safeString("hostname", obj)

	if controlURL == "" || preAuthKey == "" || hostname == "" {
		return nil, errors.New("missing required fields: controlURL, preAuthKey, hostname")
	}

	return &IPNConfig{
		ControlURL: controlURL,
		PreAuthKey: preAuthKey,
		Hostname:   hostname,
	}, nil
}

type TunnelConfig struct {
	IPAddress    string
	Username     string
	Timeout      int
	OnData       func(data string)
	OnConnect    func()
	OnDisconnect func()
}

func ParseTunnelConfig(obj js.Value) (*TunnelConfig, error) {
	if obj.IsUndefined() || obj.IsNull() {
		return nil, errors.New("tunnel config cannot be undefined or null")
	}

	ipAddress := safeString("ipAddress", obj)
	username := safeString("username", obj)
	if ipAddress == "" || username == "" {
		return nil, errors.New("missing required fields: ipAddress, username")
	}

	timeout := safeInt("timeout", obj)
	if timeout <= 0 {
		timeout = 30
	}

	config := &TunnelConfig{
		IPAddress: ipAddress,
		Username:  username,
		Timeout:   timeout,
	}

	onData := obj.Get("onData")
	if onData.IsUndefined() || onData.IsNull() || onData.Type() != js.TypeFunction {
		return nil, errors.New("`onData` is required and must be a function")
	}
	config.OnData = func(data string) {
		onData.Invoke(data)
	}

	onConnect := obj.Get("onConnect")
	if onConnect.IsUndefined() || onConnect.IsNull() || onConnect.Type() != js.TypeFunction {
		return nil, errors.New("`onConnect` is required and must be a function")
	}
	config.OnConnect = func() {
		onConnect.Invoke()
	}

	onDisconnect := obj.Get("onDisconnect")
	if onDisconnect.IsUndefined() || onDisconnect.IsNull() || onDisconnect.Type() != js.TypeFunction {
		return nil, errors.New("`onDisconnect` is required and must be a function")
	}
	config.OnDisconnect = func() {
		onDisconnect.Invoke()
	}

	return config, nil
}

func safeString(key string, obj js.Value) string {
	if obj.IsUndefined() || obj.IsNull() {
		return ""
	}

	val := obj.Get(key)
	if val.IsUndefined() || val.IsNull() {
		return ""
	}

	return val.String()
}

func safeInt(key string, obj js.Value) int {
	if obj.IsUndefined() || obj.IsNull() {
		return 0
	}

	val := obj.Get(key)
	if val.IsUndefined() || val.IsNull() {
		return 0
	}

	return val.Int()
}
