# TLS & Certificates

Everything Headplane does with TLS lives on this page: terminating HTTPS
in-process, trusting private certificate authorities for outbound
connections, and the interactions with cookies and the bundled Docker
healthcheck.

## Custom Certificate Authorities

If you front any of the services Headplane talks to — your Headscale server,
your OIDC provider, an HTTPS Docker daemon, etc. — with a private or
self-signed certificate authority, Headplane needs to trust that CA. The
cleanest way to do that is the standard Node.js `NODE_EXTRA_CA_CERTS`
environment variable, which is honoured for **every** outbound TLS
connection in the process (OIDC discovery, Headscale API, Docker, anything
else that uses `fetch` or `https`).

Provide it as a path to a PEM-encoded bundle of one or more CA certificates:

```bash
NODE_EXTRA_CA_CERTS=/etc/headplane/extra-cas.pem
```

In Docker, bind-mount the bundle and pass the variable through:

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

The bundle is added **on top of** the system trust store, so public
certificates (Let's Encrypt, ZeroSSL, etc.) keep working.

> `headscale.tls_cert_path` is a narrower knob that pins Headscale's API
> connection to exactly one certificate, bypassing the rest of the trust
> store. It still has its place if you want Headplane to refuse anything
> other than that specific cert for Headscale, but `NODE_EXTRA_CA_CERTS` is
> the right tool whenever you simply want to add a CA to the trusted set.

## TLS Termination

Headplane can terminate TLS itself when both `server.tls_cert_path` and
`server.tls_key_path` are set in the configuration file. Both must point to
PEM-encoded files that Headplane can read.

```yaml
server:
  port: 443
  tls_cert_path: "/var/lib/headplane/tls/fullchain.pem"
  tls_key_path: "/var/lib/headplane/tls/privkey.pem"
```

When TLS is configured Headplane serves HTTPS/1.1 on `server.port`. HTTP/2
and HTTP/3 are intentionally not supported in-process — terminate those at a
reverse proxy (e.g. Caddy or Traefik) and forward to Headplane over HTTP/1.1
if you need them today.

`server.cookie_secure` is forced to `true` whenever TLS is enabled (browsers
refuse `Secure`-less cookies over HTTPS); a warning is logged if your config
had it set to `false`.

For most deployments we still recommend terminating TLS at a reverse proxy
(see [Reverse Proxying](./#reverse-proxying)) so you can share certificates
with Headscale and other services. Built-in TLS is meant for the simpler
"Headplane on a single box" scenarios.

## Healthcheck

The bundled Docker healthcheck picks up the right scheme and port
automatically — Headplane writes its loopback URL to `/tmp/headplane-listen`
when it starts, and the healthcheck reads it from there. So flipping TLS on
or off requires no healthcheck-specific configuration; everything just
works.
