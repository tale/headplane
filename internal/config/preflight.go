package config

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// Checks to make sure all required environment variables are set.
// TSAuthKey is only required when there is no existing tsnet state.
func validateRequired(config *Config) error {
	if config.Hostname == "" {
		return fmt.Errorf("%s is required", HostnameEnv)
	}

	if config.TSControlURL == "" {
		return fmt.Errorf("%s is required", TSControlURLEnv)
	}

	if config.WorkDir == "" {
		return fmt.Errorf("%s is required", WorkDirEnv)
	}

	if config.TSAuthKey == "" && !hasExistingState(config.WorkDir) {
		return fmt.Errorf("%s is required for first run (no existing state in %s)", TSAuthKeyEnv, config.WorkDir)
	}

	return nil
}

// hasExistingState checks if tsnet has previously stored identity state.
func hasExistingState(workDir string) bool {
	_, err := os.Stat(filepath.Join(workDir, "tailscaled.state"))
	return err == nil
}

// Pings the Tailscale control server to make sure it's up and running
func validateTSReady(config *Config) error {
	testURL := config.TSControlURL
	if strings.HasSuffix(testURL, "/") {
		testURL = testURL[:len(testURL)-1]
	}

	testURL = fmt.Sprintf("%s/key?v=116", testURL)
	resp, err := http.Get(testURL)
	if err != nil {
		return fmt.Errorf("Failed to connect to TS control server: %s", err)
	}

	if resp.StatusCode != 200 {
		return fmt.Errorf("Failed to connect to TS control server: %s", resp.Status)
	}

	return nil
}
