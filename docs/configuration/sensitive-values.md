---
title: Sensitive values
description: Load secrets from files instead of the config file.
---

# Sensitive values

Secrets can live in their own files instead of the config file. For each
option below, set the `_path` variant to a file and Headplane reads the value
from it, trimming surrounding whitespace:

| Option                   | File variant                  |
| ------------------------ | ----------------------------- |
| `server.cookie_secret`   | `server.cookie_secret_path`   |
| `headscale.api_key`      | `headscale.api_key_path`      |
| `oidc.client_secret`     | `oidc.client_secret_path`     |
| `oidc.headscale_api_key` | `oidc.headscale_api_key_path` |

`oidc.headscale_api_key` is deprecated; use `headscale.api_key` instead.

```yaml
server:
  cookie_secret_path: "/run/secrets/headplane_cookie_secret"
```

Set either the value or its `_path`, not both. Headplane refuses to start if
both are set, or if the file can't be read.

## Environment variables in paths

These paths can include environment variables as `${NAME}`, which fits
systemd's `LoadCredential`:

```yaml
headscale:
  api_key_path: "${CREDENTIALS_DIRECTORY}/headscale_api_key"
```

Headplane refuses to start if a variable in the path isn't set. Other options
that end in `_path`, such as `headscale.config_path`, are ordinary file paths:
Headplane doesn't read secrets from them or expand variables in them.

## As environment variables

The `_path` variants work as [environment variables](/configuration#environment-variables)
too, for example `HEADPLANE_OIDC__CLIENT_SECRET_PATH=/run/secrets/oidc`.
