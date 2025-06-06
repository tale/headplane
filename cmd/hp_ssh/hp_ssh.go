//go:build js && wasm

package main

import (
	"log"
	"syscall/js"

	"github.com/tale/headplane/internal/hp_ipn"
)

func main() {
	js.Global().Set("newIPN", js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) != 1 {
			log.Fatal("Usage: newIPN(config)")
			return nil
		}

		return hp_ipn.NewIPN(args[0])
	}))

	<-make(chan bool)
}
