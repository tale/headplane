package main

import (
	"fmt"
	"net/http"
	"os"
	"time"
)

func main() {
	client := http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get("http://localhost:3000/admin/healthz")
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
