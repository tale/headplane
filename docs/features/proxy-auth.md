---
title: Proxy Authentication
description: Delegate Headplane authentication to a trusted reverse proxy.
outline: [2, 3]
---

:::warning
Proxy authentication is **dangerously powerful**. If misconfigured, it can allow
anyone to impersonate users and gain access to Headplane.

It is recommended to use Headplane's built-in SSO integrations over proxy
authentication if possible. No guarantees are made about the security of proxy
authentication.
:::

# Proxy Authentication

Proxy authentication lets Headplane delegate user authentication to a trusted
reverse proxy. This is useful when Headplane is already protected by middleware
such as nginx basic auth, Authelia, Authentik, or another SSO-aware proxy and
you do not want users to log in to Headplane separately.

Proxy authentication is intentionally opt-in and requires `headscale.api_key`.
When enabled, Headplane trusts identity headers only on requests whose client IP
matches `server.proxy_auth.allowed_cidrs`; all Headscale API calls then use the
configured `headscale.api_key`.

## Basic Configuration

```yaml
headscale:
  api_key: "<your-headscale-api-key>"

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

`user_header` is required for a request to authenticate and defaults to
`Remote-User`. The value becomes the stable proxy identity in Headplane as
`proxy:<value>`. `email_header`, `name_header`, and `picture_header` are
optional profile metadata headers.

The first proxy-authenticated user is created as the Headplane owner, matching
the normal SSO first-user behavior. Subsequent users are created as members and
can be reassigned from the Users page.

## Client IP Checks

If `allowed_cidrs` is omitted, Headplane trusts only localhost. By default, this
CIDR check uses the socket address connected to Headplane, not
`X-Forwarded-For`, `X-Real-IP`, or other forwarded headers. Configure
`allowed_cidrs` for the direct address range your proxy uses to connect to
Headplane.

## Forwarded Client IP Headers

If you need to check the original client IP from a proxy header, set `ip_header`
to `X-Forwarded-For`, `X-Real-IP`, or another header your proxy controls. When
`ip_header` is set, Headplane only reads that header if the direct socket peer
matches `trusted_proxy_cidrs` (default localhost). The first IP in the header is
then checked against `allowed_cidrs`:

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

::: warning
Only enable proxy authentication when Headplane is not directly reachable by
untrusted clients. Anyone who can connect to Headplane from an allowed CIDR will
be able to spoof the configured identity headers. Only configure `ip_header`
for headers set or overwritten by your trusted reverse proxy.
:::

## Header Reference

| Field                                   | Description                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `server.proxy_auth.enabled`             | Enables proxy authentication.                                                        |
| `server.proxy_auth.user_header`         | Header containing the stable authenticated user identity. Defaults to `Remote-User`. |
| `server.proxy_auth.email_header`        | Optional header containing the authenticated user's email address.                   |
| `server.proxy_auth.name_header`         | Optional header containing the authenticated user's display name.                    |
| `server.proxy_auth.picture_header`      | Optional header containing the authenticated user's profile picture URL.             |
| `server.proxy_auth.allowed_cidrs`       | Client CIDRs allowed to authenticate. Defaults to localhost.                         |
| `server.proxy_auth.ip_header`           | Optional original-client-IP header such as `X-Forwarded-For` or `X-Real-IP`.         |
| `server.proxy_auth.trusted_proxy_cidrs` | Direct proxy CIDRs trusted to supply `ip_header`. Defaults to localhost.             |
