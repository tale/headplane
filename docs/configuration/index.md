---
title: Configuration
description: Configure Headplane with its config file and environment variables.
---

# Configuration

Headplane reads its settings from a YAML file, `/etc/headplane/config.yaml`
unless `HEADPLANE_CONFIG_PATH` points somewhere else. The
[example configuration](https://github.com/tale/headplane/blob/main/config.example.yaml)
documents every option. Only `headscale.url` and `server.cookie_secret` are
required; everything else has a default.

Upgrading from an older version? See [Upgrading](/upgrading) for what changed.

## Data directory

Headplane keeps its database and the agent's state in `server.data_path`,
`/var/lib/headplane` by default. It must be persistent and writable by
Headplane. In Docker, mount it as a volume.

## Environment variables

Any option that takes a single value can also be set with an environment
variable, which overrides the config file. Lists and maps, such as
`server.proxy_auth.allowed_cidrs`, only work in the file. Take the option's path, join the parts with double underscores,
uppercase it and prefix it with `HEADPLANE_`:

| Option               | Environment variable            |
| -------------------- | ------------------------------- |
| `headscale.url`      | `HEADPLANE_HEADSCALE__URL`      |
| `server.port`        | `HEADPLANE_SERVER__PORT`        |
| `oidc.client_secret` | `HEADPLANE_OIDC__CLIENT_SECRET` |

`true`, `false` and numbers are converted to their types. If no config file
exists at all, Headplane runs on environment variables alone.

:::note
Older versions only read these when `HEADPLANE_LOAD_ENV_OVERRIDES` was set, and
also loaded a `.env` file. Environment variables are now always read, that
variable is deprecated, and `.env` files are no longer loaded.
:::

Secrets can also come from a file instead of the config or the environment. See [Sensitive values](/configuration/sensitive-values).

## Debug logging

Headplane logs newline-delimited JSON, with a timestamp, level, component and
message on each line, so log tools can index it directly. Set
`HEADPLANE_DEBUG_LOG=true` for debug logs. They're verbose, so avoid leaving
them on in production.
