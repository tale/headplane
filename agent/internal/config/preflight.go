package config

import (
	"fmt"
	"net/http"
	"strings"
)

// Checks to make sure all required environment variables are set
func validateRequired(config *Config) error {
	if config.Hostname == "" {
		return fmt.Errorf("%s is required", HostnameEnv)
	}

	if config.TSControlURL == "" {
		return fmt.Errorf("%s is required", TSControlURLEnv)
	}

	if config.TSAuthKey == "" {
		return fmt.Errorf("%s is required", TSAuthKeyEnv)
	}

	if config.WorkDir == "" {
		return fmt.Errorf("%s is required", WorkDirEnv)
	}

	return nil
}

// Pings the Tailscale control server to make sure it's up and running
func validateTSReady(config *Config) error {
	testURL := config.TSControlURL
	if strings.HasSuffix(testURL, "/") {
		testURL = testURL[:len(testURL)-1]
	}

	testURL = fmt.Sprintf("%s/health", testURL)
	resp, err := http.Get(testURL)
	if err != nil {
		return fmt.Errorf("Failed to connect to TS control server: %s", err)
	}

	if resp.StatusCode != 200 {
		return fmt.Errorf("Failed to connect to TS control server: %s", resp.Status)
	}

	return nil
}
