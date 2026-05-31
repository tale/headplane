package main

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

// hp_healthcheck pings the Headplane healthz endpoint. It's invoked
// from the Docker HEALTHCHECK directive inside the same container
// as Headplane itself.
//
// To stay fully zero-config, Headplane writes the exact URL the
// healthcheck should hit — scheme, port, and basename included — to
// listenFile when it starts accepting connections (see
// runtime/http.ts and app/server/main.ts). This binary just reads
// that file and GETs the URL verbatim. No env vars, no YAML
// parsing, no path-joining, no compile-time knowledge of the
// basename.
//
// If the file is missing (e.g. the server hasn't finished booting
// on the very first probe, or this is an old image being run with
// a new healthcheck) we fall back to the historical default.
const (
	listenFile = "/tmp/headplane-listen"
	defaultURL = "http://localhost:3000/admin/healthz"
)

func main() {
	url := readListenFile()

	client := http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			// Self-signed certs are normal for in-process TLS termination
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	resp, err := client.Get(url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Health check failed: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Fprintf(os.Stderr, "Health check returned non-OK status: %d\n", resp.StatusCode)
		os.Exit(1)
	}

	fmt.Println("Health check passed.")
}

func readListenFile() string {
	data, err := os.ReadFile(listenFile)
	if err != nil {
		return defaultURL
	}
	url := strings.TrimSpace(string(data))
	if url == "" {
		return defaultURL
	}
	return url
}
