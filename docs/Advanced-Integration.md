# Advanced Integration

![Integration Preview](/assets/advanced-preview.png)

With the advanced integration it's possible to control Access Control Lists (ACLs) and the Headscale configuration via the Headplane UI.
Every single aspect of this integration is optional, meaning you can only use what you want.
If you want to use this integration, you do not need Docker and you can make it work with Headscale and Headplane running natively.

### Configuration Editing

When the configuration file is available to Headplane, the `DNS` and `Settings` tabs will become functional.
Similar to the Tailscale UI, you'll be able to edit the configuration without needing to manually edit the file.
Headscale will read the file from the path given in the `CONFIG_FILE` environment variable.
By default this is set to `/etc/headscale/config.yaml`.

> One important think to note is that environment variables always take priority over the configuration file.
> The `HEADSCALE_URL`, `OIDC_CLIENT_ID`, `OIDFC_ISSUER`, and `OIDC_CLIENT_SECRET` will be preferred over the configuration file if available.

### Access Control Lists (ACLs)

![ACL Preview](/assets/acl-preview.png)

Headplane will enable the `Access Controls` tab if it is able to read an ACL file from Headscale.<br>
The ACL file path is read from the following sources in order of priority:

- **Environment Variable**: If you set the `ACL_FILE` environment variable, Headplane will read the file from that path.
- **Configuration Integration**: If you've set this up, then Headplane will read the `acl_policy_path` key from the configuration file.

### Docker Integration

The Docker integration can be used to automatically reload the configuration or ACLs when they are changed.
In order for this to work, you'll need to pass in the `HEADSCALE_CONTAINER` environment variable.
This should be either the name or ID of the Headscale container (you can retrieve this using `docker ps`).
If the other integrations aren't setup, then Headplane will automatically disable the Docker integration.

By default the integration will check for `/var/run/docker.sock`, however you can override this by
setting the `DOCKER_SOCK` environment variable if you use a different configuration than the default.
When setting `DOCKER_SOCK`, you'll need to include the protocol (e.g., `unix://` or `tcp://`).
Headplane currently does not support the HTTPS protocol for the Docker socket.

## Deployment

Requirements:
- Headscale 0.23 alpha or later
- Headscale and Headplane need a Reverse Proxy (NGINX, Traefik, Caddy, etc)
- Headscale needs to be running in a docker container

Here's a good Docker Compose example:
```yaml
version: '3.8'
services:
  headscale:
    image: 'headscale/headscale:0.23.0-alpha5'
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
    image: ghcr.io/tale/headplane:latest
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

      HEADSCALE_CONTAINER: 'headscale'
      DISABLE_API_KEY_LOGIN: 'true'
      HOST: '0.0.0.0'
      PORT: '3000'
        
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

> For a breakdown of each configuration variable, please refer to the [Configuration](/docs/Configuration.md) guide. 
> It explains what each variable does, how to configure them, and what the default values are.

You may also choose to run it natively with the distributed binaries on the releases page.
You'll need to manage running this yourself, and I would recommend making a `systemd` unit.

## Configuration Scenarios

Since the configuration is fairly modular you can have a variety of different setups.<br>
Here are a few examples to inspire you and show you what can work and what can't:

#### Full Integration
Headscale runs in a container, Headplane can run in either a container or natively.
Headplane is able to manage the configuration file and ACLs that Headscale uses.
When changes happen, the Docker integration will automatically reload the configuration and ACLs.

> Note that the full integration currently isn't possible if Headscale isn't running in a container.

#### Configuration Only
Headscale and Headplane can either run in containers or natively.
Headplane is able to manage the configuration file and ACLs that Headscale uses.
When changes are made, Headscale will need to be manually restarted to apply the changes.

#### ACL Only
Headscale and Headplane can either run in containers or natively.
Headplane is able to manage the ACLs that Headscale uses.
When changes are made, Headscale will need to be sent a `SIGHUP` to reload the ACLs.
In this scenario, Headplane does not have access to the configuration file.

#### Read-Only Configuration or ACLs
If the configuration or ACLs are read-only, Headplane will not be able to manage them.
Instead you'll only be able to view the configurations on the UI and need to edit them manually.

#### No Integration
If no integration is setup, Headplane will not be able to manage the configuration or ACLs.
This is the simplest setup by far, however it also heavily reduces the capabilities of Headplane.
