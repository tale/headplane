package config

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func loadTestConfig(t *testing.T, tailscaleNetNS string) *Config {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)

	t.Setenv(DebugEnv, "false")
	t.Setenv(HostnameEnv, "headplane-agent")
	t.Setenv(TSControlURLEnv, server.URL)
	t.Setenv(TSAuthKeyEnv, "test-auth-key")
	t.Setenv(TSNetNSEnv, tailscaleNetNS)
	t.Setenv(WorkDirEnv, t.TempDir())

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned an error: %v", err)
	}

	return cfg
}

func TestLoadTailscaleNetNSEnabledByDefault(t *testing.T) {
	cfg := loadTestConfig(t, "")
	if !cfg.TSNetNS {
		t.Fatal("TSNetNS is false, want true")
	}
}

func TestLoadTailscaleNetNSDisabled(t *testing.T) {
	cfg := loadTestConfig(t, "false")
	if cfg.TSNetNS {
		t.Fatal("TSNetNS is true, want false")
	}
}
