## Docker Integration

The Docker integration allows you to run Headplane and Headscale separately
in a dockerized environment. It allows you to unlock full functionality such as
automatic reloading of ACLs, DNS management, and Headscale configuration
management.

### Deployment

> When running with the Docker integration, it's assumed that both Headscale and
Headplane will run as containers. If you are running Headscale natively, then
refer to the [Native Integration](/docs/integration/Native.md) guide.

To enable the Docker integration, set the `HEADSCALE_INTEGRATION` environment
variable to `docker`. You'll also need to supply `HEADSCALE_CONTAINER` with the
name or ID of the Headscale container.

By default Headplane uses `unix:///var/run/docker.sock` to connect to Docker.
This can be overridden by setting the `DOCKER_SOCK` environment variable. For
example, a remote socket would be `tcp://<my-remote-host>:2375`. When setting
the variable, you'll need to specify the protocol (`unix://` or `tcp://`).

> The `DOCKER_SOCK` variable does not support the HTTPS protocol.

To enable the Docker integration, set `HEADSCALE_INTEGRATION=docker` in the environment variables.
Additionally, you'll need to pass in the `HEADSCALE_CONTAINER` environment variable.
This should be either the name or ID of the Headscale container (you can retrieve this using `docker ps`).
If the other integrations aren't setup, then Headplane will automatically disable the Docker integration.

By default the integration will check for `/var/run/docker.sock`, however you can override this by
setting the `DOCKER_SOCK` environment variable if you use a different configuration than the default.
When setting `DOCKER_SOCK`, you'll need to include the protocol (e.g., `unix://` or `tcp://`).
Headplane currently does not support the HTTPS protocol for the Docker socket.

Here's an example deployment using Docker Compose (recommended). Keep in mind
that you'll NEED to setup a reverse proxy and this is incomplete:
```yaml
services:
  headscale:
    image: 'headscale/headscale:0.23.0'
    container_name: 'headscale'
    restart: 'unless-stopped'
    command: 'serve'
    volumes:
      - './data:/var/lib/headscale'
      - './configs:/etc/headscale'
    ports:
      - '8080:8080'
    environment:
      TZ: 'America/New_York'
  headplane:
    container_name: headplane
    image: ghcr.io/tale/headplane:0.3.5
    restart: unless-stopped
    volumes:
      - './data:/var/lib/headscale'
      - './configs:/etc/headscale'
      - '/var/run/docker.sock:/var/run/docker.sock:ro'
    ports:
      - '3000:3000'
    environment:
      # This is always required for Headplane to work
      COOKIE_SECRET: 'abcdefghijklmnopqrstuvwxyz'

      HEADSCALE_INTEGRATION: 'docker'
      HEADSCALE_CONTAINER: 'headscale'
      DISABLE_API_KEY_LOGIN: 'true'
      HOST: '0.0.0.0'
      PORT: '3000'
        
      # Only set this to false if you aren't behind a reverse proxy
      COOKIE_SECURE: 'false'

      # Overrides the configuration file values if they are set in config.yaml
      # If you want to share the same OIDC configuration you do not need this
      OIDC_CLIENT_ID: 'headscale'
      OIDC_ISSUER: 'https://sso.example.com'
      OIDC_CLIENT_SECRET: 'super_secret_client_secret'

      # This NEEDS to be set with OIDC, regardless of what's in the config
      # This needs to be a very long-lived (999 day) API key used to create
      # shorter ones for OIDC and allow the OIDC functionality to work
      ROOT_API_KEY: 'abcdefghijklmnopqrstuvwxyz'
```

> For a breakdown of each configuration variable, please refer to the
[Configuration](/docs/Configuration.md) guide. 
> It explains what each variable does, how to configure them, and what the
default values are.
