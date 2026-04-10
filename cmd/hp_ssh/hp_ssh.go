//go:build js && wasm

package main

import (
	"context"
	"log"
	"syscall/js"

	"github.com/tale/headplane/internal/hp_ipn"
)

func main() {
	log.Printf("Loading WASM Headplane SSH module")

	factory := js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) != 1 {
			log.Printf("Usage: create(config)")
			return nil
		}

		config, err := hp_ipn.ParseIPNConfig(args[0])
		if err != nil {
			log.Printf("Error parsing config: %v", err)
			return nil
		}

		callbacks := hp_ipn.ParseIPNCallbacks(args[0])

		ipn, err := hp_ipn.NewTsWasmIpn(config, callbacks)
		if err != nil {
			callbacks.OnError(err.Error())
			return nil
		}

		go func() {
			if err := ipn.Start(context.Background()); err != nil {
				callbacks.OnError(err.Error())
			}
		}()

		return map[string]any{
			"openTunnel": js.FuncOf(func(this js.Value, args []js.Value) any {
				if len(args) != 1 {
					log.Printf("Usage: openTunnel(config)")
					return nil
				}

				tunnelConfig, err := hp_ipn.ParseTunnelConfig(args[0])
				if err != nil {
					log.Printf("Error parsing tunnel config: %v", err)
					return nil
				}

				session := ipn.NewSSHSession(tunnelConfig)
				go session.ConnectAndRun()

				return map[string]any{
					"writeInput": js.FuncOf(func(this js.Value, args []js.Value) any {
						if len(args) == 1 {
							session.WriteInput(args[0].String())
						}
						return nil
					}),

					"resize": js.FuncOf(func(this js.Value, args []js.Value) any {
						if len(args) != 2 {
							return nil
						}
						session.Resize(args[0].Int(), args[1].Int())
						return nil
					}),

					"close": js.FuncOf(func(this js.Value, args []js.Value) any {
						session.Close()
						return nil
					}),
				}
			}),
		}
	})

	resolve := js.Global().Get("__hp_ssh_resolve")
	if resolve.Type() != js.TypeFunction {
		log.Printf("__hp_ssh_resolve is not set, cannot initialize")
		return
	}

	resolve.Invoke(factory)
	js.Global().Delete("__hp_ssh_resolve")

	log.Printf("WASM Headplane SSH module loaded successfully")
	<-make(chan bool)
}
