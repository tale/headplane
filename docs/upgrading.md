---
title: Upgrading
description: What to change when upgrading Headplane from an older version.
---

# Upgrading

Most upgrades only need the new image or a rebuild. The versions below also
need a change on the operator's side. When skipping versions, apply every
section between the old version and the new one, oldest first. The
[changelog](/changelog) lists everything else that changed.

Back up `server.data_path`, `/var/lib/headplane` by default, before
upgrading. It holds Headplane's database.

To get patch releases without moving to a new minor version by surprise, pin
the Docker image to a minor tag, such as `ghcr.io/tale/headplane:0.8`.

## Next release

- **DNS records only come from `dns.extra_records_path`.** Records listed
  inline under Headscale's `dns.extra_records` show as read-only. Move them
  into the JSON file to keep editing them. See
  [DNS records](/configuration/integrations#dns-records).
- **The proc and Kubernetes integrations restart Headscale instead of
  reloading it.** They stop Headscale and wait for it to come back, so
  something has to restart it: systemd with `Restart=always`, which Headscale's
  own unit and the NixOS module already set, or the kubelet. Without one,
  Headscale stays down after the first change.
- **Only one integration can be enabled.** With more than one, Headplane
  turns them all off and logs an error.
- **People without user management rights can't link themselves.** After an
  SSO sign-in, only owners, admins and IT admins pick their own Headscale user.
  Everyone else links automatically or is linked from the **Users** page. See
  [Linking by hand](/features/users-roles#linking-by-hand).

## 0.8.1

- **SSO stays off until `server.base_url` is set.** Previously it failed at
  sign-in. Set it to Headplane's public URL.
- Proxy rules that rewrite the `Origin` header, added as a workaround for
  0.8.0, can be removed.

## 0.8.0

- Building from source needs Go 1.27.1 or newer.

## 0.7.0

- **Headscale 0.27.0 or newer is required.**
- **The agent needs Headscale 0.28 and `headscale.api_key`.** It now creates
  its own pre-auth key, so remove `integration.agent.pre_authkey` and
  `integration.agent.cache_path`. See [Headplane Agent](/features/agent).
- **`oidc.headscale_api_key` moved to `headscale.api_key`.** The old option
  still works for now. See [API keys](/configuration/api-keys).
- **Logs are JSON**, one object per line. Update anything that parses them.
- **Accounts are linked to Headscale users.** SSO accounts link by subject or
  email at sign-in. Accounts that don't match need linking by hand before they
  can create auth keys for themselves or use Browser SSH. See
  [Users & roles](/features/users-roles#linking-to-headscale-users).

## 0.6.2

- **`oidc.redirect_uri` is replaced by `server.base_url`.** Headplane logs the
  value to use when it finds the old option.
- **PKCE is opt-in.** If the provider requires it, set `oidc.use_pkce: true`.

## 0.6.1

- **Headplane keeps a database in `server.data_path`**, as `hp_persist.db`.
  The directory has to be persistent and writable, such as a Docker volume.
  Existing users migrate on their own.
- **The Docker image has no shell.** For debugging, use the matching `-shell`
  tag, such as `ghcr.io/tale/headplane:0.6.1-shell`.

## 0.6.0

- Headscale 0.26.0 or newer is required.

## 0.5.6

- **SSO accounts get roles.** New accounts start as members with no dashboard
  access, and the first person to sign in becomes the owner. Sign in right
  after upgrading to claim the owner account. See
  [Users & roles](/features/users-roles).

## 0.5

- **Settings moved from environment variables to a config file.** Start from
  the [example configuration](https://github.com/tale/headplane/blob/main/config.example.yaml).
  Settings that used to be shared with Headscale, such as `public_url` and
  `oidc`, are now separate. See [Configuration](/configuration).

## Deprecated options

These still load, but log a warning at startup.

| Option                          | Instead                                           |
| ------------------------------- | ------------------------------------------------- |
| `oidc.headscale_api_key`        | `headscale.api_key`                               |
| `oidc.redirect_uri`             | `server.base_url`                                 |
| `HEADPLANE_LOAD_ENV_OVERRIDES`  | Nothing. Environment variables are always read.   |
| `integration.agent.pre_authkey` | Nothing. The agent creates its own key.           |
| `integration.agent.cache_path`  | Nothing. The agent keeps its state in `work_dir`. |
| `oidc.strict_validation`        | Nothing. It has no effect.                        |
