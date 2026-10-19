---
title: Proxy authentication
description: Let a trusted reverse proxy sign people in to Headplane.
---

# Proxy authentication

With proxy authentication, a reverse proxy that already signs people in, such
as Authelia, Authentik or nginx with basic auth, tells Headplane who each
request is from through a header. People then sign in once, at the proxy.

:::warning
Headplane trusts the identity header from any address allowed below. If anyone
else can reach Headplane from one of those addresses, they can sign in as
anyone. When an OIDC provider is available, [SSO](/features/sso) is the safer
choice.
:::

## Setting it up

Proxy authentication needs
[`headscale.api_key`](/configuration/api-keys#the-servers-key), which Headplane
uses on behalf of signed-in people:

```yaml
headscale:
  api_key: "<key>"

server:
  proxy_auth:
    enabled: true
    user_header: "Remote-User"
    email_header: "Remote-Email"
    name_header: "Remote-Name"
    allowed_cidrs:
      - "127.0.0.1/32"
      - "::1/128"
```

Each request needs `user_header`, `Remote-User` by default. Its value becomes
the account's identity in Headplane, as `proxy:<value>`, so it has to stay the
same for each person. The email, name and `picture_header` headers are
optional and fill in the profile.

Roles and account linking work as described in
[Users & roles](/features/users-roles).

## Which requests are trusted

Headplane only reads the identity headers on requests from `allowed_cidrs`,
which defaults to localhost. It checks the address of the connection itself,
not `X-Forwarded-For` or similar headers, so set `allowed_cidrs` to the
addresses the proxy connects from.

When another proxy sits in front, and the check should use the original
client's address instead, set `ip_header` to a header the trusted proxy sets
or overwrites, such as `X-Forwarded-For`. Headplane then reads it only on
connections from `trusted_proxy_cidrs`, also localhost by default, and checks
the first address in it against `allowed_cidrs`:

```yaml
server:
  proxy_auth:
    enabled: true
    ip_header: "X-Forwarded-For"
    trusted_proxy_cidrs:
      - "127.0.0.1/32"
    allowed_cidrs:
      - "10.0.0.0/8"
```

## Options

All options sit under `server.proxy_auth`.

| Option                | Default       | Description                                           |
| --------------------- | ------------- | ----------------------------------------------------- |
| `enabled`             |               | Turns proxy authentication on                         |
| `user_header`         | `Remote-User` | The header with each person's stable identity         |
| `email_header`        |               | The header with their email address                   |
| `name_header`         |               | The header with their display name                    |
| `picture_header`      |               | The header with a profile picture URL                 |
| `allowed_cidrs`       | localhost     | Addresses allowed to authenticate                     |
| `ip_header`           |               | A header with the original client address, if checked |
| `trusted_proxy_cidrs` | localhost     | Proxy addresses trusted to set `ip_header`            |
