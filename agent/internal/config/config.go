package config

import "os"

// Config represents the configuration for the agent.
type Config struct {
	Debug        bool
	Hostname     string
	TSControlURL string
	TSAuthKey    string
	WorkDir      string
}

const (
	DebugEnv        = "HEADPLANE_AGENT_DEBUG"
	HostnameEnv     = "HEADPLANE_AGENT_HOSTNAME"
	TSControlURLEnv = "HEADPLANE_AGENT_TS_SERVER"
	TSAuthKeyEnv    = "HEADPLANE_AGENT_TS_AUTHKEY"
	WorkDirEnv      = "HEADPLANE_AGENT_WORK_DIR"
)

// Load reads the agent configuration from environment variables.
func Load() (*Config, error) {
	c := &Config{
		Debug:        false,
		Hostname:     os.Getenv(HostnameEnv),
		TSControlURL: os.Getenv(TSControlURLEnv),
		TSAuthKey:    os.Getenv(TSAuthKeyEnv),
		WorkDir:      os.Getenv(WorkDirEnv),
	}

	if os.Getenv(DebugEnv) == "true" {
		c.Debug = true
	}

	if err := validateRequired(c); err != nil {
		return nil, err
	}

	if err := validateTSReady(c); err != nil {
		return nil, err
	}

	return c, nil
}
