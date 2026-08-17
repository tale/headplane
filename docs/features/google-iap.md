---
title: Google IAP
description: Authenticate Headplane users from a verified Google Cloud Identity-Aware Proxy assertion.
outline: [2, 3]
---

# Google IAP

Google Cloud's [Identity-Aware Proxy](https://cloud.google.com/iap) (IAP) sits in front of a
load balancer and authenticates users before any request reaches your service. Headplane can
take its identity directly from IAP, so users never see a Headplane login screen.

Unlike [Proxy Authentication](/features/proxy-auth), this does not trust a header because of
where the request came from. IAP signs every request with a short-lived ES256 JWT, and
Headplane verifies that signature against Google's published keys before accepting the
identity. A forged header is rejected no matter which address it arrives from.

Google IAP requires `headscale.api_key` to be configured. All Headscale API calls are made
with that key.

## Basic Configuration

```yaml
headscale:
  api_key: "<your-headscale-api-key>"

server:
  jwt_auth:
    enabled: true
    provider: "google_iap"
    audience: "/projects/123456789/global/backendServices/987654321"
```

`audience` is required. Without it, Headplane would accept any assertion Google signed —
including one minted for somebody else's backend service in a different project. Headplane
refuses to start if `jwt_auth` is enabled without it.

### Finding your audience

For a global external load balancer, the audience is
`/projects/PROJECT_NUMBER/global/backendServices/BACKEND_SERVICE_ID`. Both values are numeric
IDs, not names:

```sh
gcloud projects describe PROJECT_ID --format='value(projectNumber)'
gcloud compute backend-services describe BACKEND_SERVICE_NAME --global --format='value(id)'
```

For App Engine the format is `/projects/PROJECT_NUMBER/apps/PROJECT_ID` instead. Set
`server.jwt_auth.audience` to whichever matches your deployment.

## Locking Down Ingress

::: danger
IAP only protects traffic that goes through the load balancer. If Headplane is reachable by
any other route, that route has no authentication in front of it at all.
:::

Headplane rejects requests carrying no assertion, so a direct connection cannot impersonate a
user. But it will still fall back to API key login and any other configured method, so treat
direct reachability as something to remove rather than something Headplane compensates for.

On Compute Engine or GKE, restrict the serving port to Google's load balancer ranges:

```sh
gcloud compute firewall-rules create allow-lb-to-headplane \
  --network=YOUR_NETWORK \
  --action=allow \
  --direction=ingress \
  --source-ranges=35.191.0.0/16,130.211.0.0/22 \
  --rules=tcp:3000
```

On Cloud Run, reject anything that does not arrive through the load balancer:

```sh
gcloud run services update headplane --ingress=internal-and-cloud-load-balancing
```

## Load Balancer Timeout

::: warning
The default backend service timeout of 30 seconds will break live updates.
:::

Headplane streams machine and user changes over Server-Sent Events. A Google Cloud load
balancer counts that long-lived response against the backend timeout and severs it after 30
seconds, so the UI appears to stop updating and reconnect in a loop. This looks like a
Headplane bug and is not one.

Raise the timeout on the backend service:

```sh
gcloud compute backend-services update BACKEND_SERVICE_NAME --global --timeout=3600
```

## Restricting Who Can Sign In

IAP decides who reaches Headplane at all — grant `roles/iap.httpsResourceAccessor` to the
users or groups who should have access. That is the primary control.

`allowed_domains` adds a second check inside Headplane:

```yaml
server:
  jwt_auth:
    enabled: true
    provider: "google_iap"
    audience: "/projects/123456789/global/backendServices/987654321"
    allowed_domains:
      - "example.com"
```

::: warning
The `hd` claim that carries the hosted domain is only present for Google Workspace accounts.
Consumer accounts such as `@gmail.com` have no `hd` at all, so Headplane falls back to the
domain part of the email address. Do not treat `allowed_domains` as proof that only Workspace
identities can sign in — set the IAP access policy for that.
:::

## Roles

The first user to sign in becomes the Headplane owner, matching the normal SSO behaviour.
Everyone after that is created with `default_role` (`member` unless you change it) and can be
reassigned from the Users page.

```yaml
server:
  jwt_auth:
    default_role: "viewer"
```

### Users who previously signed in with Google SSO

IAP identifies users differently than an OIDC login does, so somebody who used Google SSO
before will arrive as a **new** user with the default role and lose whatever role they had.

Headplane does not link the two automatically. Matching on email address would let anyone who
controls a recycled address inherit another user's access, which is a worse problem than the
one it solves. Instead, sign in as the owner and reassign the new accounts from the Users
page. Plan for this before switching an existing instance over — in particular, make sure the
first person to sign in through IAP is someone you are happy to have as owner.

## Sessions and Signing Out

IAP owns the session. Headplane verifies the assertion on each request and stores no session
of its own, so there is nothing to expire on the Headplane side.

Signing out redirects to IAP's own sign-out endpoint. Clearing only the Headplane cookie would
leave the IAP session intact and sign the user straight back in.

## API and Automation Access

IAP blocks any request without an identity, including scripted ones. Present a Google identity
token to get through it:

```sh
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://headplane.example.com/admin/api/info
```

Headplane's own API key login still works behind IAP for automation that needs it.

## Troubleshooting

When an assertion is rejected, the login page explains why and the Headplane log carries the
detail. The log is the place to look first — the page deliberately does not echo the
assertion's contents, since it may be reachable before anyone has authenticated.

| Log code             | Meaning                                                                      |
| -------------------- | ---------------------------------------------------------------------------- |
| `missing_assertion`  | The request did not come through IAP. Check that you are reaching Headplane through the load balancer. |
| `audience_mismatch`  | `audience` does not match this backend service. The log shows both the expected and the received value. |
| `issuer_mismatch`    | The assertion came from something other than IAP.                            |
| `expired_assertion`  | The assertion is past its expiry — usually clock skew on the Headplane host.  |
| `invalid_assertion`  | The signature did not verify, or the token was signed with an unexpected algorithm. |
| `domain_not_allowed` | The identity's domain is not in `allowed_domains`.                            |
| `missing_subject`    | The assertion carried no user identifier.                                     |

## Configuration Reference

| Field                             | Description                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `server.jwt_auth.enabled`         | Enables assertion-based authentication.                                                       |
| `server.jwt_auth.provider`        | The proxy issuing the assertion. Currently `google_iap`.                                      |
| `server.jwt_auth.audience`        | **Required.** The audience the assertion must carry.                                          |
| `server.jwt_auth.allowed_domains` | Optional hosted domains permitted to sign in. Any identity IAP admits is accepted when unset. |
| `server.jwt_auth.default_role`    | Role for newly created users. The first user always becomes owner.                             |
| `server.jwt_auth.header`          | Override the assertion header. Defaults to the provider's.                                     |
| `server.jwt_auth.issuer`          | Override the expected issuer. Defaults to the provider's.                                      |
| `server.jwt_auth.jwks_url`        | Override the key set URL. Defaults to the provider's.                                          |
| `server.jwt_auth.algorithms`      | Override the accepted signing algorithms. Defaults to the provider's.                          |

The last four exist for compatibility and testing. Changing them weakens the guarantees
described on this page, so leave them unset unless you have a specific reason.
