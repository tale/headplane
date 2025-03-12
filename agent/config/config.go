package config

import (
	"os"

	_ "github.com/joho/godotenv/autoload"
)

// Config represents the configuration for the agent.
type Config struct {
	Debug        bool
	Hostname     string
	TSControlURL string
	TSAuthKey    string
	HPControlURL string
	HPAuthKey    string
}

const (
	DebugEnv        = "HEADPLANE_AGENT_DEBUG"
	HostnameEnv     = "HEADPLANE_AGENT_HOSTNAME"
	TSControlURLEnv = "HEADPLANE_AGENT_TS_SERVER"
	TSAuthKeyEnv    = "HEADPLANE_AGENT_TS_AUTHKEY"
	HPControlURLEnv = "HEADPLANE_AGENT_HP_SERVER"
	HPAuthKeyEnv    = "HEADPLANE_AGENT_HP_AUTHKEY"
)

// Load reads the agent configuration from environment variables.
func Load() (*Config, error) {
	c := &Config{
		Debug:        false,
		Hostname:     os.Getenv(HostnameEnv),
		TSControlURL: os.Getenv(TSControlURLEnv),
		TSAuthKey:    os.Getenv(TSAuthKeyEnv),
		HPControlURL: os.Getenv(HPControlURLEnv),
		HPAuthKey:    os.Getenv(HPAuthKeyEnv),
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

	if err := validateHPReady(c); err != nil {
		return nil, err
	}

	return c, nil
}
