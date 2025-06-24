package main

import (
	"fmt"
	"os"
)

var imageTag string

func main() {
	if imageTag == "" {
		os.Exit(1)
	}

	fmt.Fprintln(os.Stderr, "Headplane containers do not contain a shell by default.")
	fmt.Fprintln(os.Stderr, "If you need a non-production container with a shell and root access use:")
	fmt.Fprintf(os.Stderr, "\n%s-shell\n\n", imageTag)
	os.Exit(127)
}
