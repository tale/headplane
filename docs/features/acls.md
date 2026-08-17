---
title: Access Control
description: Edit the Headscale ACL policy, tags and groups from the Headplane UI.
---

# Access Control

Headscale stores its Access Control List (ACL) as a single HuJSON policy. The
**Access Control** page in Headplane exposes that policy in two ways: a
structured editor for the parts most people change day to day, and the raw file
editor for everything else.

## Requirements

The policy can only be written through the web UI when Headscale runs in
database policy mode:

```yaml
# Headscale config.yaml
policy:
  mode: database
```

In `file` mode the page is read-only and shows a notice explaining why. Editing
also requires the `write_policy` capability, which the `owner`, `admin` and
`network_admin` roles have.

## Rules

The **Rules** tab renders the policy as three lists:

- **Access rules** — the `acls` section. Each rule allows traffic from a set of
  sources to a set of destinations. Destinations include a port range, for
  example `tag:web:80,443`. A destination entered without one gets `:*`
  appended, since Headscale rejects a destination that has no port.
- **SSH rules** — the `ssh` section, including `check` mode and its check
  period.
- **Hosts** — the `hosts` section, which names an IP address or CIDR range so
  rules can reference it.

Adding or editing an entry opens a dialog where sources and destinations are
built from chips. Every group, tag, host and Headscale user already known to
your tailnet is offered as a one-click suggestion, so rules can be written
without memorising the syntax.

## Tags and groups

The **Tags & Groups** tab manages the `groups` and `tagOwners` sections.

- **Groups** bundle Headscale users so rules can refer to a team. Members are
  written as `username@`, which is how Headscale references users in a policy.
- **Tags** identify machines by role rather than by owner. Each tag lists the
  users and groups allowed to assign it. The list also shows which machines
  currently carry the tag.

Tags must exist under `tagOwners` before they mean anything: assigning an
undeclared tag to a machine is allowed by Headscale, but no rule will ever match
it. The tag dialog on the **Machines** page flags such tags with a warning and
links back here.

Group membership can also be edited from the **Users** page: the row menu has an
**Edit groups** entry, and the groups a user belongs to are shown under their
name. Both surfaces write to the same `groups` section of the policy.

## Editing the file directly

The **Edit file** tab is the original CodeMirror editor over the raw policy, and
**Preview changes** shows a diff against the saved version. The structured
editors write into the same buffer, so a change made visually shows up in the
file editor and in the diff before it is saved.

Nothing is sent to Headscale until **Save** is pressed.

::: warning Comments are not preserved
HuJSON allows comments and trailing commas. Headplane reads them, but the
structured editors regenerate the policy text, which drops comments. The Rules
and Tags & Groups tabs show a notice when the loaded policy contains comments —
use the file editor if you want to keep them.
:::

Unknown top-level keys such as `autoApprovers` and `nodeAttrs` are preserved
untouched, so using the visual editor never silently drops parts of a policy
that Headplane does not model.
