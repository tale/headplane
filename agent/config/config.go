package config

import (
	_ "github.com/joho/godotenv/autoload"
	"os"
)

// Config represents the configuration for the agent.
type Config struct {
	Debug        bool
	Hostname     string
	TSControlURL string
	TSAuthKey    string
	HPControlURL string
}

const (
	DebugEnv        = "HP_AGENT_DEBUG"
	HostnameEnv     = "HP_AGENT_HOSTNAME"
	TSControlURLEnv = "HP_AGENT_TS_SERVER"
	TSAuthKeyEnv    = "HP_AGENT_TS_AUTHKEY"
	HPControlURLEnv = "HP_AGENT_HP_SERVER"
)

// Load reads the agent configuration from environment variables.
func Load() (*Config, error) {
	c := &Config{
		Debug:        false,
		Hostname:     os.Getenv(HostnameEnv),
		TSControlURL: os.Getenv(TSControlURLEnv),
		TSAuthKey:    os.Getenv(TSAuthKeyEnv),
		HPControlURL: os.Getenv(HPControlURLEnv),
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
