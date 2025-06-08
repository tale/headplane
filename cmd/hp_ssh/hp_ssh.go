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
		}
	}))

	log.Printf("WASM Headplane SSH module loaded successfully")
	<-make(chan bool)
}
