---
title: JWT header authentication
description: Let an identity-aware proxy such as Google IAP or Cloudflare Access sign people in to Headplane with a signed assertion.
---

# JWT header authentication

Some reverse proxies authenticate people before a request reaches the service
behind them and inject a **signed** JWT describing who they are. Headplane can
verify that assertion against the proxy's published keys and take the person's
identity from it, so nobody sees a Headplane login screen.

Unlike [proxy authentication](/features/proxy-auth), this does not trust a
header because of where the request came from: a forged header is rejected no
matter which address it arrives from. Any proxy that signs a header works, as
long as the four values it uses are stated in the configuration.

## Setting it up

JWT header authentication needs
[`headscale.api_key`](/configuration/api-keys#the-servers-key), which Headplane
uses on behalf of signed-in people. Headplane refuses to start when `jwt_auth`
is enabled without it.

```yaml
headscale:
  api_key: "<key>"

server:
  jwt_auth:
    enabled: true
    header: "x-goog-iap-jwt-assertion"
    issuer: "https://cloud.google.com/iap"
    jwks_endpoint: "https://www.gstatic.com/iap/verify/public_key-jwk"
    audience: "/projects/123456789/global/backendServices/987654321"
```

All four values are required. Without `audience` in particular, any assertion
the issuer ever signed would be accepted, including one minted for somebody
else's service.

### Known proxies

| Proxy             | `header`                   | `issuer`                              | `jwks_endpoint`                                            | Algorithm |
| ----------------- | -------------------------- | ------------------------------------- | ---------------------------------------------------------- | --------- |
| Google IAP        | `x-goog-iap-jwt-assertion` | `https://cloud.google.com/iap`        | `https://www.gstatic.com/iap/verify/public_key-jwk`        | `ES256`   |
| Cloudflare Access | `cf-access-jwt-assertion`  | `https://<team>.cloudflareaccess.com` | `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` | `RS256`   |
| Pomerium          | `x-pomerium-jwt-assertion` | the Pomerium URL                      | `<url>/.well-known/pomerium/jwks.json`                     | `ES256`   |

These values are provided for convenience; the proxy's own documentation is
authoritative. AWS ALB (`x-amzn-oidc-data`) is not supported, as it publishes a
PEM per key ID rather than a JWKS.

### Optional settings

```yaml
server:
  jwt_auth:
    algorithms: ["ES256"]
    logout_url: "/?gcp-iap-mode=CLEAR_LOGIN_COOKIE"
    default_role: "member"
```

- `algorithms` defaults to the asymmetric families. Pin the one the proxy uses.
  Symmetric algorithms (`HS256` and relatives) are refused, since a JWKS
  publishes public keys that could otherwise be used as the signing secret.
- `logout_url` sends the browser to the proxy's own sign-out. Without it,
  clearing the Headplane cookie leaves the proxy session intact and signs the
  person straight back in.
- `default_role` is given to new accounts. The first person to sign in always
  becomes the owner.

## Locking down ingress

:::warning
The proxy only protects traffic that goes through it. If Headplane is reachable
by any other route, that route has no authentication in front of it.
:::

A request without an assertion falls back to API key login and any other
configured method, so Headplane must only be reachable through the proxy. On
Google Cloud, restrict the serving port to the load balancer ranges:

```sh
gcloud compute firewall-rules create allow-lb-to-headplane \
  --network=YOUR_NETWORK \
  --action=allow \
  --direction=ingress \
  --source-ranges=35.191.0.0/16,130.211.0.0/22 \
  --rules=tcp:3000
```

Who can sign in at all is decided by the proxy. For Google IAP, grant
`roles/iap.httpsResourceAccessor` to the people or groups who should have
access.

## Google IAP specifics

For a global external load balancer the audience is
`/projects/PROJECT_NUMBER/global/backendServices/BACKEND_SERVICE_ID`. Both are
numeric IDs, not names:

```sh
gcloud projects describe PROJECT_ID --format='value(projectNumber)'
gcloud compute backend-services describe BACKEND_SERVICE_NAME --global --format='value(id)'
```

:::warning[Raise the backend timeout]
The default backend service timeout of 30 seconds severs the Server-Sent Events
stream Headplane uses for live updates, so the UI appears to stop updating.

```sh
gcloud compute backend-services update BACKEND_SERVICE_NAME --global --timeout=3600
```

:::

## Accounts and sessions

The proxy owns the session. Headplane verifies the assertion on every request
and stores no session of its own.

Accounts are identified by the assertion's issuer and subject, so someone who
previously signed in with SSO arrives as a **new** account with `default_role`.
Headplane does not link the two by email address, since a recycled address
would inherit another person's access. Reassign roles from the Users page.

For scripted access behind Google IAP, present an identity token:

```sh
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://headplane.example.com/admin/api/info
```

## Troubleshooting

When an assertion is rejected, the sign-in page shows a generic notice and the
Headplane log carries the reason, including the expected and received audience
on a mismatch. Expired assertions usually mean clock skew on the Headplane host.
