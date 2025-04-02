# Bare-Metal Mode

Bare-Metal mode is the most flexible way to deploy Headplane. It allows you to
run Headplane on any system without the need for Docker or any other container
runtime. This is not recommended, but I understand that everyone has
different needs.

> It works with both the **Simple** and **Integrated** deployment modes. Refer
> to the section below for instructions on configuring Integrated mode.

## Deployment

Requirements:
- Headscale 0.25 or newer (already deployed)
- Node.js 22 LTS or newer
- [PNPM](https://pnpm.io/installation) 10.x
- A finished configuration file (config.yaml)

Before installing Headplane, ensure that `/var/lib/headplane` exists and is
writable by the user that will run the Headplane service. You can create this
directory with the following command:

```sh
sudo mkdir -p /var/lib/headplane
# Replace headplane:headplane with the appropriate user and group if not root.
sudo chown -R headplane:headplane /var/lib/headplane
```

Clone the Headplane repository, install dependencies, and build the project:
```sh
git clone https://github.com/tale/headplane
cd headplane
git checkout v0.5.5 # Or whatever tag you want to use
pnpm install
pnpm build
```

## Running Headplane
You can start headplane through `pnpm start` or `node build/headplane/server.js`.
Headplane expects the `build` directory to be present when running the server.
The structure of this folder is very important and should not be tampered with.

### Integrated Mode
Since you are running Headplane in Bare-Metal, you most likely also are running
Headscale in Bare-Metal. Refer to the [**Integrated Mode**](/docs/Integrated-Mode.md)
guide for instructions on setting up the integrated mode in Native Linux (/proc).

### Changing the Admin Path
Since you are building Headplane yourself, you are able to configure the admin
path to be anything you want. When running `pnpm build`, you can pass the
`__INTERNAL_PREFIX` environment variable to change the admin path. For example:

```sh
__INTERNAL_PREFIX=/admin2 pnpm build
```

Just keep in mind that the admin path is not configurable at runtime, so you
will need to rebuild the project if you want to change it. Also, anything aside
from `/admin` is not officially supported and could break in future versions.

> Refer to the [**Configuration**](/docs/Configuration.md) guide for help with
> setting up your `config.yaml` file to the appropriate values.

### Systemd Unit
Here is an example of a systemd unit file that you can use to manage the
Headplane service:

```ini
[Unit]
Description=Headplane
After=network.target

[Service]
Type=simple
User=headplane
Group=headplane
WorkingDirectory=/path/to/headplane
ExecStart=/usr/bin/node /path/to/headplane/build/headplane/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

You will need to replace `/path/to/headplane` with the actual path to the
Headplane repository on your system. Save this file as `headplane.service` in
`/etc/systemd/system/` and run `systemctl enable headplane` to enable the service.

Other fields may also need some configuration, as this unit expects a user and a
group called `headplane` to exist on the system. You can change these values to
match your system's configuration.
