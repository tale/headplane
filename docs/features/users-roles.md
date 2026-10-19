---
title: Users & roles
description: How Headplane accounts, roles and links to Headscale users work.
---

# Users & roles

Headplane keeps its own accounts, separate from Headscale's users. An account is
created the first time someone signs in through [SSO](/features/sso) or
[proxy authentication](/features/proxy-auth). Its role decides what that person
can do in Headplane, and its link to a Headscale user decides which machines
and auth keys are theirs.

## Roles

| Role              | Can do                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| **Owner**         | Everything, including transferring ownership. There's exactly one owner.                       |
| **Admin**         | Everything except transferring ownership.                                                      |
| **Network Admin** | Manage ACLs, DNS and network settings, view machines and users, create auth keys.              |
| **IT Admin**      | Manage machines, users, settings and sign-in restrictions. View, but not change, ACLs and DNS. |
| **Auditor**       | View everything, and create auth keys for themselves.                                          |
| **Viewer**        | View machines and users, and create auth keys for themselves.                                  |
| **Member**        | No access to the dashboard. They see a home page that helps them connect their devices.        |

The first person to sign in becomes the owner. Everyone after that starts as a
member, until an owner or admin changes their role on the **Users** page.
With SSO, new accounts can start with a different role, or take theirs from
your identity provider. See [Roles from the identity provider](/features/sso#roles-from-the-identity-provider).

Signing in with a Headscale API key skips roles entirely and grants full access,
since the key already has full control of Headscale.

## Linking to Headscale users

Each account can be linked to one Headscale user, which makes that user's
machines and auth keys the account's own. Auditors and viewers need a link to
create auth keys for themselves, and [Browser SSH](/features/ssh) uses it to
pick who to connect as.

Headplane links an account by itself when it finds an unclaimed Headscale user
with the same SSO subject or the same email address. It tries when someone
signs in, and again whenever an unlinked account opens Headplane. So if
Headscale creates users through SSO too, an account links as soon as its first
device joins. The [SSO page](/features/sso#how-accounts-match-headscale-users)
covers when subjects match.

When nothing matches, the account has to be linked by hand:

- **Admins** get a one-time screen after signing in to pick their own Headscale
  user. They can skip it and link later from the **Users** page.
- **Everyone else** is linked by an admin from the **Users** page. Until then,
  their home page asks them to contact an administrator.

Only admins can pick a user for themselves, because a link grants access to that
user's machines and auth keys. Letting anyone pick would let a new account claim
someone else's Headscale identity.
