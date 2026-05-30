package main

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"os"
	"time"
)

// hp_healthcheck pings the Headplane /healthz endpoint. It's invoked
// from the Docker HEALTHCHECK directive, so it must work whether the
// container is serving plain HTTP or has TLS termination enabled.
//
// Configuration (via env, all optional):
//   - HEADPLANE_HEALTHCHECK_URL   full URL, takes precedence over the
//     pieces below (default: http://localhost:3000/admin/healthz)
//   - HEADPLANE_HEALTHCHECK_TLS   "true" to use https://
//   - HEADPLANE_HEALTHCHECK_HOST  default: localhost
//   - HEADPLANE_HEALTHCHECK_PORT  default: 3000
//   - HEADPLANE_HEALTHCHECK_PATH  default: /admin/healthz
func main() {
	url := healthcheckURL()

	client := http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			// We just care that the server is alive and with us
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
	os.Exit(0)
}

func healthcheckURL() string {
	if v := os.Getenv("HEADPLANE_HEALTHCHECK_URL"); v != "" {
		return v
	}

	scheme := "http"
	if os.Getenv("HEADPLANE_HEALTHCHECK_TLS") == "true" {
		scheme = "https"
	}

	host := os.Getenv("HEADPLANE_HEALTHCHECK_HOST")
	if host == "" {
		host = "localhost"
	}

	port := os.Getenv("HEADPLANE_HEALTHCHECK_PORT")
	if port == "" {
		port = "3000"
	}

	path := os.Getenv("HEADPLANE_HEALTHCHECK_PATH")
	if path == "" {
		path = "/admin/healthz"
	}

	return fmt.Sprintf("%s://%s:%s%s", scheme, host, port, path)
}
