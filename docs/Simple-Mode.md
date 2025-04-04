# Simple Mode

Simple mode enables you to quickly deploy Headplane and is recommended for any
testing or simple environments. It does not include the automatic management of
DNS and Headplane settings, requiring manual editing and reloading when making
changes. If you're looking for a more feature-complete deployment method, check
out [**Integrated Mode**](/docs/Integrated-Mode.md).

## Deployment
> If you are not looking to deploy with Docker, follow the [**Bare-Metal**](/docs/Bare-Metal.md) deployment guide.

Requirements:
- Docker and Docker Compose
- Headscale 0.25 or newer (already deployed)
- A finished configuration file (config.yaml)

Here is what a sample Docker Compose deployment would look like:
```yaml
services:
  headplane:
    # I recommend you pin the version to a specific release
    image: ghcr.io/tale/headplane0.5.10:
    container_name: headplane
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - './config.yaml:/etc/headplane/config.yaml'
      - './headplane-data:/var/lib/headplane'
```

This will result in the Headplane UI being available at the `/admin` path of the
server you deployed it on. The `/admin` path is currently not configurable unless
you build the container yourself or run Headplane in Bare-Metal mode.

> Refer to the [**Configuration**](/docs/Configuration.md) guide for help with
> setting up your `config.yaml` file to the appropriate values.
