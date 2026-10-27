---
title: TLS & certificates
description: Serve Headplane over HTTPS and trust private certificate authorities.
---

# TLS & certificates

## Custom certificate authorities

When Headscale, the OIDC provider or anything else Headplane connects to uses a
certificate from a private or self-signed CA, point Node.js's
`NODE_EXTRA_CA_CERTS` at a PEM bundle of the CA certificates:

```bash
NODE_EXTRA_CA_CERTS=/etc/headplane/extra-cas.pem
```

It applies to every outbound connection, and adds to the system's trusted CAs
rather than replacing them, so public certificates keep working. In Docker,
mount the bundle and set the variable:

```yaml
services:
  headplane:
    image: ghcr.io/tale/headplane:latest
    environment:
      NODE_EXTRA_CA_CERTS: /etc/headplane/extra-cas.pem
    volumes:
      - "./internal-ca.pem:/etc/headplane/extra-cas.pem:ro"
      - "./config.yaml:/etc/headplane/config.yaml"
      - "./headplane-data:/var/lib/headplane"
```

`headscale.tls_cert_path` is narrower: Headplane's connection to Headscale then
trusts only that certificate, and nothing from the system store. Use it to pin
Headscale to one certificate. To add a CA, `NODE_EXTRA_CA_CERTS` is the better
fit.

## TLS termination

Headplane can serve HTTPS itself when both `server.tls_cert_path` and
`server.tls_key_path` point to readable PEM files:

```yaml
server:
  port: 443
  tls_cert_path: "/var/lib/headplane/tls/fullchain.pem"
  tls_key_path: "/var/lib/headplane/tls/privkey.pem"
```

It serves HTTP/1.1 only. For HTTP/2 or HTTP/3, put a
[reverse proxy](/configuration/reverse-proxy) in front instead.

With TLS on, `server.cookie_secure` is always `true`, and Headplane logs a
warning if the config sets it to `false`. The Docker healthcheck needs no
changes.

This suits a single machine without a proxy. When Headscale sits behind a proxy
anyway, terminating TLS there lets both share one certificate.
