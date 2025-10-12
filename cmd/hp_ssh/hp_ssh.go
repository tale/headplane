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
	js.Global().Set("TsWasmNet", js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) != 2 {
			log.Fatal("Usage: TsWasmNet(config, callbacks)")
			return nil
		}

		options, err := hp_ipn.ParseTsWasmNetOptions(args[0])
		if err != nil {
			log.Fatal("Error parsing options:", err)
			return nil
		}

		callbacks, err := hp_ipn.ParseTsWasmNetCallbacks(args[1])
		if err != nil {
			log.Fatal("Error parsing callbacks:", err)
			return nil
		}

		ipn, err := hp_ipn.NewTsWasmIpn(options, callbacks)
		if err != nil {
			log.Fatal("Error creating TsWasmIpn:", err)
			return nil
		}

		return map[string]any{
			"Start": js.FuncOf(func(this js.Value, args []js.Value) any {
				ipn.Start(context.Background())
				return nil
			}),
			"OpenSSH": js.FuncOf(func(this js.Value, args []js.Value) any {
				if len(args) != 3 {
					log.Fatal("Usage: OpenSSH(host, user, options)")
					return nil
				}

				hostname := args[0]
				if hostname.IsNull() || hostname.IsUndefined() {
					log.Fatal("Hostname must be a non-null, non-undefined string")
					return nil
				}

				if hostname.Type() != js.TypeString {
					log.Fatal("Hostname must be a string")
					return nil
				}

				username := args[1]
				if username.IsNull() || username.IsUndefined() {
					log.Fatal("Username must be a non-null, non-undefined string")
					return nil
				}

				if username.Type() != js.TypeString {
					log.Fatal("Username must be a string")
					return nil
				}

				sshOptions, err := hp_ipn.ParseSSHXtermConfig(args[2])
				if err != nil {
					log.Fatal("Error parsing SSH options:", err)
					return nil
				}

				session := ipn.NewSSHSession(hostname.String(), username.String(), sshOptions)
				go session.ConnectAndRun()

				return map[string]any{
					"Close": js.FuncOf(func(this js.Value, args []js.Value) any {
						return session.Close() != nil
					}),

					"Resize": js.FuncOf(func(this js.Value, args []js.Value) any {
						if len(args) != 2 {
							log.Fatal("Usage: Resize(cols, rows)")
							return nil
						}

						rows := args[0].Int()
						cols := args[1].Int()
						if cols <= 0 || rows <= 0 {
							log.Fatal("Columns and rows must be positive integers")
							return nil
						}

						return session.Resize(cols, rows) == nil
					}),
				}
			}),
		}
	}))

	log.Printf("WASM Headplane SSH module loaded successfully")
	<-make(chan bool)
}
