---
title: API keys
description: The two ways Headplane uses Headscale API keys, and how to rotate them.
---

# API keys

Headplane talks to Headscale's API with Headscale API keys. It uses them in two
separate ways, and they have different needs.

## Signing in with a key

Until [SSO](/features/sso) or [proxy authentication](/features/proxy-auth) is
set up, the sign-in page asks for a Headscale API key. A key has full control
of Headscale, so signing in with one grants full access to Headplane, with no
role attached. The session ends when the key expires.

```bash
headscale apikeys create --expiration 90d
```

## The server's key

`headscale.api_key` is a key Headplane keeps for itself. People who sign in
through SSO or a proxy have no Headscale key of their own, so Headplane checks
their role and then makes the request with this key. The
[agent](/features/agent) uses it too, to join the tailnet. SSO, proxy
authentication and the agent don't start without it.

```bash
headscale apikeys create --expiration 365d
```

```yaml
headscale:
  api_key: "<key>"
```

To keep the key out of the config file, use `api_key_path` instead. See
[Sensitive values](/configuration/sensitive-values).

Give this key a long expiration and note when it runs out. Once it expires,
every request made for SSO and proxy-auth users fails, and the agent stops
syncing. Headplane reads the key at startup, so it needs a restart to pick up a
new one.

`oidc.headscale_api_key` is the old name for this option. It still works when
`headscale.api_key` isn't set, but it's deprecated.

## Rotating the server's key

1. Create a new key with `headscale apikeys create --expiration 365d`.
2. Set it as `headscale.api_key` and restart Headplane.
3. Find the old key's prefix with `headscale apikeys list`, then expire it with
   `headscale apikeys expire --prefix <prefix>`.
