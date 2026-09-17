---
title: JWT Header Authentication
description: Authenticate Headplane users from a signed assertion injected by an identity-aware proxy, such as Google IAP or Cloudflare Access.
outline: [2, 3]
---

# JWT Header Authentication

Some reverse proxies authenticate users before any request reaches your service
and inject a **signed** JWT describing who they are. Headplane can verify that
assertion and take its identity from it, so users never see a Headplane login
screen.

Unlike [Proxy Authentication](/features/proxy-auth), this does not trust a
header because of where the request came from. The assertion is verified against
the proxy's published signing keys, so a forged header is rejected no matter
which address it arrives from.

Headplane does not maintain a list of supported proxies. You state the four
values your proxy uses, and anything that signs a header works.

JWT header authentication requires `headscale.api_key` to be configured — all
Headscale API calls are made with that key, and Headplane refuses to start if
`jwt_auth` is enabled without it.

## Configuration

```yaml
headscale:
  api_key: "<your-headscale-api-key>"

server:
  jwt_auth:
    enabled: true
    header: "x-goog-iap-jwt-assertion"
    issuer: "https://cloud.google.com/iap"
    jwks_url: "https://www.gstatic.com/iap/verify/public_key-jwk"
    audience: "/projects/123456789/global/backendServices/987654321"
```

All four are required. Headplane refuses to start without them, because each one
missing is a way to accept assertions it should not:

- Without `audience`, any assertion that issuer ever signed is accepted —
  including one minted for somebody else's service.
- Without `issuer`, any token those keys can verify is accepted.
- Without `header` or `jwks_url` there is nothing to read or verify against.

### Known proxies

| Proxy | `header` | `issuer` | `jwks_url` | Algorithm |
| --- | --- | --- | --- | --- |
| Google IAP | `x-goog-iap-jwt-assertion` | `https://cloud.google.com/iap` | `https://www.gstatic.com/iap/verify/public_key-jwk` | `ES256` |
| Cloudflare Access | `cf-access-jwt-assertion` | `https://<team>.cloudflareaccess.com` | `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` | `RS256` |
| Pomerium | `x-pomerium-jwt-assertion` | your Pomerium URL | `<url>/.well-known/pomerium/jwks.json` | `ES256` |

These are provided for convenience and are not a support commitment. Check your
proxy's own documentation — a value that changes upstream will be wrong here
before it is wrong there.

AWS ALB (`x-amzn-oidc-data`) is **not** supported. Its keys are served as a PEM
per key ID rather than a JWKS, and verifying it safely also requires checking
the `signer` claim against the load balancer ARN.

### Optional settings

```yaml
server:
  jwt_auth:
    algorithms: ["ES256"]
    allowed_domains: ["example.com"]
    domain_claim: "hd"
    logout_url: "/?gcp-iap-mode=CLEAR_LOGIN_COOKIE"
    default_role: "member"
```

`algorithms` defaults to the asymmetric families. Pinning the single algorithm
your proxy actually uses is better — it stops a different one being accepted on
your behalf.

::: warning
Symmetric algorithms (`HS256` and relatives) are refused, and Headplane will not
start if you ask for one. A JWKS publishes *public* keys; verifying with a
symmetric algorithm would let anyone use a published key as the signing secret
and forge assertions.
:::

`logout_url` sends the browser to the proxy's own sign-out. Without it, clearing
the Headplane cookie leaves the proxy session intact and signs the user straight
back in.

## Restricting Who Can Sign In

The proxy decides who reaches Headplane at all — for Google IAP, grant
`roles/iap.httpsResourceAccessor` to the users or groups who should have access.
That is the primary control.

`allowed_domains` adds a second check inside Headplane, comparing against
`domain_claim` and falling back to the email domain when that claim is absent.

::: warning
Google's `hd` claim is only present for Workspace accounts — consumer accounts
such as `@gmail.com` have no `hd` at all. Do not treat `allowed_domains` as proof
that only Workspace identities can sign in; set the proxy's access policy for
that.
:::

## Locking Down Ingress

::: danger
The proxy only protects traffic that goes through it. If Headplane is reachable
by any other route, that route has no authentication in front of it.
:::

Headplane rejects requests carrying no assertion, but it will still fall back to
API key login and any other configured method, so treat direct reachability as
something to remove rather than something Headplane compensates for.

On Google Cloud with Compute Engine or GKE, restrict the serving port to the
load balancer ranges:

```sh
gcloud compute firewall-rules create allow-lb-to-headplane \
  --network=YOUR_NETWORK \
  --action=allow \
  --direction=ingress \
  --source-ranges=35.191.0.0/16,130.211.0.0/22 \
  --rules=tcp:3000
```

On Cloud Run, reject anything not arriving through the load balancer:

```sh
gcloud run services update headplane --ingress=internal-and-cloud-load-balancing
```

## Google IAP Specifics

### Finding the audience

For a global external load balancer the audience is
`/projects/PROJECT_NUMBER/global/backendServices/BACKEND_SERVICE_ID`. Both are
numeric IDs, not names:

```sh
gcloud projects describe PROJECT_ID --format='value(projectNumber)'
gcloud compute backend-services describe BACKEND_SERVICE_NAME --global --format='value(id)'
```

For App Engine the format is `/projects/PROJECT_NUMBER/apps/PROJECT_ID`.

### Load balancer timeout

::: warning
The default backend service timeout of 30 seconds will break live updates.
:::

Headplane streams machine and user changes over Server-Sent Events. A Google
Cloud load balancer counts that long-lived response against the backend timeout
and severs it after 30 seconds, so the UI appears to stop updating and reconnect
in a loop. This looks like a Headplane bug and is not one.

```sh
gcloud compute backend-services update BACKEND_SERVICE_NAME --global --timeout=3600
```

## Roles

The first user to sign in becomes the Headplane owner, matching the normal SSO
behaviour. Everyone after that is created with `default_role` (`member` unless
you change it) and can be reassigned from the Users page.

### Users who previously signed in with SSO

A proxy identifies users differently than an OIDC login does, so somebody who
used SSO before will arrive as a **new** user with the default role and lose
whatever role they had.

Headplane does not link the two automatically. Matching on email address would
let anyone who controls a recycled address inherit another user's access, which
is a worse problem than the one it solves. Sign in as the owner and reassign the
new accounts from the Users page instead. Plan for this before switching an
existing instance over — in particular, make sure the first person to sign in
is someone you are happy to have as owner.

## Sessions and Signing Out

The proxy owns the session. Headplane verifies the assertion on each request and
stores no session of its own, so there is nothing to expire on the Headplane
side.

## API and Automation Access

An identity-aware proxy blocks any request without an identity, including
scripted ones. For Google IAP, present an identity token:

```sh
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://headplane.example.com/admin/api/info
```

Headplane's own API key login still works behind the proxy for automation that
needs it.

## Troubleshooting

When an assertion is rejected, the login page explains why and the Headplane log
carries the detail. The log is the place to look first — the page deliberately
does not echo the assertion's contents, since it may be reachable before anyone
has authenticated.

| Log code             | Meaning                                                                      |
| -------------------- | ---------------------------------------------------------------------------- |
| `missing_assertion`  | The request did not come through the proxy. Check you are reaching Headplane through it. |
| `audience_mismatch`  | `audience` does not match. The log shows both the expected and the received value. |
| `issuer_mismatch`    | The assertion came from a different issuer than `issuer`.                    |
| `expired_assertion`  | The assertion is past its expiry — usually clock skew on the Headplane host.  |
| `invalid_assertion`  | The signature did not verify, or the algorithm is outside `algorithms`.       |
| `domain_not_allowed` | The identity's domain is not in `allowed_domains`.                            |
| `missing_subject`    | The assertion carried no user identifier.                                     |

## Configuration Reference

| Field                             | Description                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `server.jwt_auth.enabled`         | Enables assertion-based authentication.                                          |
| `server.jwt_auth.header`          | **Required.** Header carrying the assertion.                                      |
| `server.jwt_auth.issuer`          | **Required.** Expected `iss`, matched exactly.                                    |
| `server.jwt_auth.jwks_url`        | **Required.** Where the proxy publishes its signing keys.                         |
| `server.jwt_auth.audience`        | **Required.** Expected `aud`, matched exactly.                                    |
| `server.jwt_auth.algorithms`      | Accepted signing algorithms. Defaults to the asymmetric families; `HS*` refused.  |
| `server.jwt_auth.allowed_domains` | Optional domains permitted to sign in.                                            |
| `server.jwt_auth.domain_claim`    | Claim carrying the hosted domain. Falls back to the email domain.                 |
| `server.jwt_auth.logout_url`      | Where to send the browser on logout.                                              |
| `server.jwt_auth.default_role`    | Role for newly created users. The first user always becomes owner.                 |
