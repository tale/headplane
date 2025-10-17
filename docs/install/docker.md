---
title: Docker
description: Install Headplane with Docker.
outline: [2, 3]
---

# Docker Installation
::: tip
If you are not looking to deploy with Docker, follow the
[**Native Mode**](./native-mode.md) deployment guide.
:::

The recommended way to deploy Headplane is through Docker. This method is quick,
easy, and works in most environments. It requires that Headscale is also running
with Docker.

## Prerequisites
- Docker and Docker Compose
- Headscale version 0.26.0 or later installed and running
- A [completed configuration file](/index.md#configuration) for Headplane. 


## Installation
Running Headplane in with Docker is as simple as applying 1 compose file:
```yaml
services:
  headplane:
    image: ghcr.io/tale/headplane:latest
    container_name: headplane
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - './config.yaml:/etc/headplane/config.yaml'
      - './headplane-data:/var/lib/headplane'
```

It's important to mount your configuration file and also provide a persistent
storage location for Headplane to store its own data. You can also change the
port mapping if you want to run it on a different port.

## Accessing Headplane

After starting the container, you can access the Headplane web interface by
navigating to `http://localhost:3000/admin` in your web browser (replace
`localhost` with your server's IP address or domain name if not running locally).

In order to log in, you'll need to supply a Headscale API key. You can create
one by running the following command within your Headscale environment:

```bash
# You may want to tweak the expiration duration as needed
headscale apikeys create --expiration 90d
```

## Enabling advanced features

You've technically completed the installation, but read on if you would like
to enable advanced features like the ability to edit network settings from the
UI or remote SSH from the browser.

### Network Management

Network management allows you to configure Tailnet settings such as DNS servers,
custom A records, the tailnet domain name, and MagicDNS from the Headplane UI.

#### Prerequisites
Network management (and other configurable Headscale features) requires that
Headplane and Headscale both run together in the same Docker machine. This is
because Headplane needs the following permissions:

- Access to read and write the Head**scale** configuration file through a shared
volume used by both Headscale and Headplane.
- Access to the Docker socket (usually `/var/run/docker.sock`, you may also use
a proxy such as [Tecnativa/docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy)).

#### Configuration

First you'll need to run both Headscale and Headplane in the same Docker
environment. Here is an example `compose.yaml` file that accomplishes this:

```yaml
services:
  headplane:
    image: ghcr.io/tale/headplane:latest
    container_name: headplane
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      # Same as before
      - '/path/to/your/config.yaml:/etc/headplane/config.yaml'
      - '/path/to/data/storage:/var/lib/headplane'

      # A shared path to the Headscale config file. It is important that the
      # path you mount this on matches `headscale.config_path` in your
      # Headplane config.yaml file.
      - '/path/to/headscale/config.yaml:/etc/headscale/config.yaml'

      # If you are using dns.extra_records in Headscale (recommended), you
      # should also mount that file here so Headplane can read and write it.
      # Ensure that the path matches `headscale.dns_records_path` in your
      # Headplane config.yaml file.
      - '/path/to/headscale/dns_records.json:/etc/headscale/dns_records.json'

      # Read-only access to the Docker socket (or a proxy)
      - '/var/run/docker.sock:/var/run/docker.sock:ro'
  headscale:
    image: headscale/headscale:0.26.0
    container_name: headscale
    restart: unless-stopped
    command: serve
    labels:
      # This label is absolutely necessary to help Headplane find Headscale.
      me.tale.headplane.target: headscale
    ports:
      - '8080:8080'
    volumes:
      # Notice how these are on the exact same path as the host for both
      # Headscale and Headplane! This is very important.
      - '/path/to/headscale/config.yaml:/etc/headscale/config.yaml'
      - '/path/to/headscale/dns_records.json:/etc/headscale/dns_records.json'

      - '/path/to/headscale/data/storage:/var/lib/headscale'
```

::: info
With some effort, you can technically run Headscale and Headplane in separate
Docker hosts and remotely connect to a Docker daemon. This is an advanced setup
that is not covered in this documentation. Refer to the
[example configuration](https://github.com/tale/headplane/blob/main/config.example.yaml)
for more details on setting it up.
:::

You'll also need to enable a few fields in your Headplane configuration file:

| Field               | Description                                            |
|---------------------|--------------------------------------------------------|
| **`integration.docker.enabled`** | Set to `true` to enable Docker integration. |
| **`headscale.config_path`** | Path to your Head**scale** configuration file within the container (e.g., `/etc/headscale/config.yaml`). |
| `headscale.dns_records_path` | *Optional*. Refer to the [example configuration](https://github.com/tale/headplane/blob/main/config.example.yaml) for details. |

With these settings in place, restart Headplane. You should now see additional
options in the UI navbar such as "DNS" and "Settings" where you can manage your
Tailnet configuration.

### Remote Web SSH

Remote Web SSH allows you to open a terminal session to your Tailscale nodes
directly from the Headplane web interface via
[Tailscale SSH](https://tailscale.com/kb/1193/tailscale-ssh). This feature
requires that Tailscale SSH is running on your nodes (done via
`tailscale up --ssh`).

This feature uses the [Headplane Agent](../features/agent.md) to facilitate the
SSH connections. Refer to the [Agent documentation](../features/agent.md) for
setup instructions.

### Single Sign-On (SSO)

Single Sign-On (SSO) authentication allows users to log in to Headplane using
external identity providers such as Google, GitHub, or any provider that
supports OpenID Connect (OIDC).

To get started with SSO, refer to the [SSO documentation](../features/sso.md)
for detailed setup instructions.


## Reverse Proxying

You *should* run Headplane behind a reverse proxy such as Nginx or Caddy in
production. Additionally, putting Headscale beind the reverse proxy allows
you to access both services via the same domain and TLS certificate.

#### Configuration

Headscale supports integrating with
[several reverse proxies](https://headscale.net/stable/ref/integration/reverse-proxy/)
such as Nginx, Caddy, Apache, etc. Deploying Headplane is as simple as adding
a handler to route any requests to `/admin` to the Headplane service. Refer
to the Traefik example below for a reference configuration. A similar setup via
Nginx without Docker is available in the
[Native Mode](./native-mode.md#reverse-proxying) installation documentation.

#### Example Traefik Configuration

The following configuration will set up Traefik to proxy all Headscale requests
on `headscale.example.com` and serve the Headplane UI under the `/admin` path.
This is identical to how Tailscale's own admin console is served.

Keep in mind this won't work on its own as you'll need to configure Traefik
and TLS certificates as needed. This is just a snippet to show how to configure
the routing for Headplane and Headscale.

```yaml
services:
  # Same as before
  headplane:
    image: ghcr.io/tale/headplane:latest
    container_name: headplane
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - '/path/to/your/config.yaml:/etc/headplane/config.yaml'
      - '/path/to/data/storage:/var/lib/headplane'
      - '/path/to/headscale/config.yaml:/etc/headscale/config.yaml'
      - '/path/to/headscale/dns_records.json:/etc/headscale/dns_records.json'
      - '/var/run/docker.sock:/var/run/docker.sock:ro'
    labels:
      # Expose the admin UI at /admin
      - 'traefik.enable=true'
      - 'traefik.http.routers.headplane.rule=Host(`headscale.example.com`) && PathPrefix(`/admin`)'
      - 'traefik.http.routers.headplane.entrypoints=websecure'
      - 'traefik.http.routers.headplane.tls=true'
  headscale:
    image: headscale/headscale:0.26.0
    container_name: headscale
    restart: unless-stopped
    command: serve
    ports:
      - '8080:8080'
    volumes:
      - '/path/to/headscale/config.yaml:/etc/headscale/config.yaml'
      - '/path/to/headscale/dns_records.json:/etc/headscale/dns_records.json'
      - '/path/to/headscale/data/storage:/var/lib/headscale'
    labels:
      - 'me.tale.headplane.target=headscale'

      # Traefik labels to expose Headscale at headscale.example.com
      - 'traefik.enable=true'
      - 'traefik.http.routers.headscale.rule=Host(`headscale.example.com`)'
      - 'traefik.http.routers.headscale.entrypoints=websecure'
      - 'traefik.http.routers.headscale.tls=true'

      # This middleware is essential to ensuring Headplane works correctly
      - 'traefik.http.routers.headscale.middlewares=cors'
      - 'traefik.http.middlewares.cors.headers.accesscontrolallowheaders=*'
      - 'traefik.http.middlewares.cors.headers.accesscontrolallowmethods=GET,POST,PUT'
      - 'traefik.http.middlewares.cors.headers.accesscontrolalloworiginlist=https://headscale.example.com'
      - 'traefik.http.middlewares.cors.headers.accesscontrolmaxage=100'
      - 'traefik.http.middlewares.cors.headers.addvaryheader=true'

      # If you would optionally like to automatically redirect / to /admin
      - 'traefik.http.routers.rewrite.rule=Host(`headscale.example.com`) && Path(`/`)'
      - 'traefik.http.routers.rewrite.service=headscale'
      - 'traefik.http.routers.rewrite.middlewares=rewrite'
      - 'traefik.http.middlewares.rewrite.addprefix.prefix=/admin'

  traefik:
    image: traefik:v3.0
    container_name: traefik
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      # Example volumes/setup, please configure Traefik as needed
      - '/var/run/docker.sock:/var/run/docker.sock:ro'
      - '/path/to/certs/storage:/certs'
```

