---
title: Native Mode
description: Install Headplane without Docker.
outline: [2, 3]
---

# Native Mode
::: tip
If you are looking to deploy with Docker, follow the
[**Docker**](./docker.md) deployment guide.
:::

Headplane can be installed and run directly on your host system without the need
for Docker. This method is suitable for users who already run Headscale natively
or prefer to avoid containers.

## Prerequisites
- A Linux-based operating system (e.g, Ubuntu, Debian, CentOS, Fedora)
- Go version 1.25.1 installed (only needed to build Headplane)
- Node.js version 22.16.x and [pnpm](https://pnpm.io/) version 10.4.x installed
- Headscale version 0.26.0 or later installed and running
- A [completed configuration file](./index.md#configuration) for Headplane. 

Before building and running Headplane, ensure that the directory defined in
`server.data_path` in your configuration exists and is writable by the user who
will run Headplane.

```bash
# Adjust as needed and set a custom user if you desire
sudo mkdir -p /var/lib/headplane
sudo chown -R $(whoami):$(whoami) /var/lib/headplane
```

## Building Headplane
Clone the Headplane repository, install dependencies, and build the project:

```bash
# You can optionally checkout a specific release tag.
git clone https://github.com/tale/headplane.git
cd headplane
pnpm install
pnpm build
```

## Running Headplane
Running Headplane is as straightforward as running `pnpm start` (or also
directly with `node build/server/index.js`). Headplane will look for a config
file at `/etc/headplane/config.yaml` by default, but you can specify a different
path by setting the `HEADPLANE_CONFIG_PATH` environment variable.

> Ensure that the `build/` directory exists relative to where the start command
> is run, otherwise Headplane will not be able to find the frontend assets.

### Example systemd Service

Slotting this file into `/etc/systemd/system/headplane.service` will allow
you to manage Headplane via systemd. Adjust the paths and user as needed,
run `sudo systemctl daemon-reload`, and then enable/start the service.

```ini
[Unit]
Description=Headplane Service
After=network.target # (or headscale.service if it runs via systemd)
Requires=network.target # (or headscale.service if it runs via systemd)
StartLimitIntervalSec=0

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/your/cloned/headplane
ExecStart=/usr/bin/node /path/to/your/cloned/headplane/build/server/index.js
Restart=on-failure
RestartSec=5s

# Uncomment and set if using a custom config path
# Environment=HEADPLANE_CONFIG_PATH=/path/to/your/config.yaml

[Install]
WantedBy=multi-user.target
```

To access Headplane, navigate to `http://localhost:3000/admin` in your web
browser (replace `localhost` with your server's IP address or domain name if
not running locally). 

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
Headplane and Headscale both run on the same machine because Headplane needs

- Access to read and write the Head**scale** configuration file
- Access to read the `/proc` filesystem on Linux to locate Headscale's process

#### Configuration

Enabling network management is as simple as setting a few additional fields in
your Headplane configuration file:

| Field               | Description                                            |
|---------------------|--------------------------------------------------------|
| **`integration.proc.enabled`** | Set to `true` to enable process inspection. |
| **`headscale.config_path`** | Path to your Head**scale** configuration file (e.g., `/etc/headscale/config.yaml`). |
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
setup instructions and specifically follow the
[native mode configuration](../features/agent.md#native-mode-configuration)
section to point Headplane to the correct agent location.


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
::: tip
If you are using a [custom path prefix](#custom-path-prefix) for Headplane,
adjust the `/admin` paths in the examples below accordingly.
:::

Headscale supports integrating with
[several reverse proxies](https://headscale.net/stable/ref/integration/reverse-proxy/)
such as Nginx, Caddy, Apache, etc. Deploying Headplane is as simple as adding
a handler to route any requests to `/admin` to the Headplane service. Refer
to the Nginx example below for a reference configuration. A similar setup via
Traefik in Docker is available in the [Docker](./docker.md#reverse-proxying)
installation documentation.

#### Example Nginx Configuration

The following configuration will set up Nginx to proxy all Headscale requests
on `headscale.example.com` and serve the Headplane UI under the `/admin` path.
This is identical to how Tailscale's own admin console is served.

```nginx
server {
    listen 80;
    listen [::]:80;

    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name headscale.example.com;

    # Or use LetsEncrypt with Certbot (up to you)
    ssl_certificate /path/to/your/fullchain.pem;
    ssl_certificate_key /path/to/your/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / { # Headscale runs on the root path
        proxy_pass http://localhost:8080/; # Adjust if Headscale runs on a different port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_redirect http:// https://;
        proxy_buffering off;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header Strict-Transport-Security "max-age=15552000; includeSubDomains" always;
    }

    location /admin/ { # Headplane is served under /admin
        proxy_pass http://localhost:3000/; # Adjust if Headplane runs on a different port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_redirect http:// https://;
        proxy_buffering off;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Custom Path Prefix

::: warning
The only officially supported path prefix for Headplane is `/admin`. Using a
custom path prefix may lead to unexpected issues and is not recommended.
:::

If for whatever reason you do not want to serve Headplane under `/admin`
(e.g., you want to serve it under `/headplane`), you can set the prefix
while building Headplane via the `__INTERNAL_PREFIX` environment variable.

```bash
# Example for /headplane prefix
git clone
cd headplane
pnpm install
# Set the prefix here
__INTERNAL_PREFIX=/headplane pnpm build
```

When running Headplane, all requests will only be served under the specified
path. Make sure to also adjust your reverse proxy configuration accordingly if
you are using one. Additionally, if you want to change the path prefix again,
you will need to rebuild Headplane with the new prefix.
