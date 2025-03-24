# Headplane Server
This code is responsible for all code that is necessary *before* any
web server is started. It is the only part of the code that contains
many side-effects (in this case, importing a module may run code).

# Hierarchy
```
server
├── index.ts: Loads everything and starts the web server.
├── config/
│   ├── env.ts: Checks the environment variables for custom overrides.
│   ├── loader.ts: Checks the configuration file and coalesces with ENV.
│   ├── schema.ts: Defines the schema for the Headplane configuration.
├── headscale/
│   ├── api-client.ts: Creates the HTTP client that talks to the Headscale API.
│   ├── config-loader.ts: Loads the Headscale configuration (if available).
│   ├── config-schema.ts: Defines the schema for the Headscale configuration.
├── web/
│   ├── agent.ts: Handles setting up the agent WebSocket if needed.
│   ├── oidc.ts: Loads and validates an OIDC configuration (if available).
│   ├── sessions.ts: Initializes the session store and methods to manage it.
