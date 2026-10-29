---
title: Guest management
description: Prepare guest requests in Headplane without provisioning network access.
---

Guest management prepares administrative requests for future temporary access.
Phase 1 stores drafts in Headplane only. It sends no email, creates no Headscale
users or auth keys, and changes no ACLs, machines, or Headscale configuration.
Saving a draft never grants VPN access or starts an access countdown.

## Manage guests

Open **Guests** in the administration navigation and select **Add Guest**.
Enter an email address, optionally a display name and administrative notes, and
choose a requested duration: 24 hours, 48 hours, 7 days, or a custom date.
A custom date requires a planned expiry. Preset durations can also include an
optional planned expiry. Dates are entered and displayed in UTC.

The duration is an intended interval after a future activation. A planned expiry
is an intended absolute deadline. Neither is an effective access expiry. A future
activation flow will need to reconcile both intentions and confirm the actual
deadline before provisioning access.

Select **Create draft**. Search by name or email, filter by status, or sort by
creation or modification date. Select **Apply** to save search options in the
address bar. Lists contain up to 25 requests per page. Select **View** or the
guest name to open details, then **Edit draft** to change information.

Select **Revoke draft** and confirm to close a request permanently. Revoked
requests remain visible for administrative history and cannot be edited or
reactivated. Revoking a draft does not revoke an existing Headscale identity,
device, or network permission. Create another draft to start a new request.
Deletion is not available in this phase.

Multiple requests may use the same email address, including multiple drafts.
Each request has a separate ID, requested access, and lifecycle. Email addresses
are trimmed and lowercased, without provider-specific alias or dot rewriting.

New planned dates must be in the future. An elapsed planned date can remain
unchanged when editing an existing draft; it never automatically expires that
draft. To change that date, select a new future date or clear it when using a
preset duration.

## Permissions and security

The `manage_guests` capability is granted only to the `owner` and `admin` roles.
IT administrators, network administrators, auditors, viewers, and members cannot
read or change guests. API key sessions retain full administrative access under
Headplane's existing authentication model. See [Users and roles](/features/users-roles).

Every loader and action checks permissions on the server. Forms use the existing
React Router action transport and its Origin checks against cross-site writes,
the signed authentication session, Valibot validation, `ActionError` form errors,
and success notifications. Notes are plain text and are never rendered as HTML.
No Headscale credentials are stored in guest records.

Edits and revocations compare the request's revision in one atomic SQL statement.
A stale form returns a conflict instead of overwriting newer information. Reload
the page before retrying. Database failures produce an error rather than a
successful no-op.

## Architecture and routes

`app/server/guests.ts` provides a service built once by `createAppContext` and
injected through `guestsContext`. Its only dependency is the existing Drizzle
SQLite client. It has no Headscale client, agent dependency, background task, or
network side effect. Expected failures are typed results mapped to page or form
errors by the routes. Shared form schemas validate at both the browser and
server boundaries.

| Internal route | Operation                            | Required capability |
| -------------- | ------------------------------------ | ------------------- |
| `/guests`      | List, search, filter, sort, paginate | `manage_guests`     |
| `/guests`      | POST `create`                        | `manage_guests`     |
| `/guests/:id`  | Read details                         | `manage_guests`     |
| `/guests/:id`  | POST `update`, `revoke`              | `manage_guests`     |

Routes are relative to `server.base_path`, so the default list address is
`/admin/guests`. The navigation and links support a custom base path.

## Data model

The additive `guest_management` migration creates `guests`. Existing tables are
unchanged. Email, creation date, and status plus creation date are indexed;
email has no uniqueness constraint.

| Column                       | Representation and purpose                                |
| ---------------------------- | --------------------------------------------------------- |
| `id`                         | ULID primary key                                          |
| `email`                      | Required normalized address, at most 254 characters       |
| `display_name`               | Optional plain text, at most 100 characters               |
| `notes`                      | Optional plain text, at most 4,000 characters             |
| `status`                     | Explicit lifecycle state                                  |
| `requested_duration_seconds` | 86,400, 172,800, or 604,800; null for a custom date       |
| `requested_expires_at`       | Optional planned UTC deadline; required for a custom date |
| `activated_at`, `expires_at` | Future effective access dates; always null in phase 1     |
| `revoked_at`                 | Administrative revocation time, null for a draft          |
| `created_at`, `updated_at`   | Required UTC timestamps                                   |
| `created_by`                 | Headplane user ID, or null for an API key session         |
| `revision`                   | Incrementing version for concurrent edit protection       |

Dates use the existing SQLite integer timestamp convention. `created_by` is
historical attribution, without a foreign key, so removing an account does not
remove guest history. API keys and their hashes are never copied into it.

| Status    | Meaning                                     | Phase 1               |
| --------- | ------------------------------------------- | --------------------- |
| `draft`   | Prepared request without provisioned access | Created and editable  |
| `pending` | Future invitation sent                      | Reserved, unavailable |
| `active`  | Future access successfully provisioned      | Reserved, unavailable |
| `expired` | Future effective access deadline elapsed    | Reserved, unavailable |
| `revoked` | Administratively closed request             | Terminal, read-only   |

The only transition is `draft` → `revoked`. Database checks enforce the phase 1
statuses, null effective access dates, supported duration intentions, and a
revocation timestamp consistent with status. Enabling the reserved states in a
future phase requires an explicit migration and provisioning workflow.

## Migration and rollback

Headplane applies the migration automatically when the updated application
starts. Back up the Headplane SQLite database before deploying, using a
consistent SQLite backup or a copy made while Headplane is stopped. Include any
WAL data when copying an open database. No Headscale migration is required.

To roll back the application, stop the updated Headplane instance and run the
previous version against the same database. The new table is additive and may
remain in place; retain its migration history and guest data for a later upgrade.
Do not drop tables or remove migration history. A full database restore is only
needed when restoring the entire prior state; it also discards all Headplane
changes made after the backup, including sessions and account changes.

## Verification

Run the repository checks:

```sh
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:integration tests/integration/headplane/guests.test.ts tests/integration/headplane/permissions.test.ts
```

Unit tests cover input validation, normalization, duration intentions, custom
dates, persistence across database reopening, concurrent edits, revocation,
unsupported lifecycle transitions, searches with SQL wildcard characters,
pagination, and database failure recovery. Migration tests preserve existing
users, sessions, and host information from a database built with prior migrations.
Integration tests use the real harness, authenticated sessions for every role,
and Headscale versions from `testedVersions()`. The lifecycle scenario compares
the policy, users, machines, and configuration before and after guest operations.

To verify a migration against an existing development database without modifying
it, pass its path explicitly:

```sh
HP_GUEST_MIGRATION_SOURCE=/path/to/development/hp_persist.db \
  pnpm test:unit tests/unit/guests/migration.test.ts
```

This opt-in test opens the source read-only, backs it up through SQLite into a
temporary directory, applies migrations only to the copy, compares hashes of
every preexisting application table, and verifies a persisted guest record.

The optional Chromium scenario checks real form submissions, persistence after
refresh, editing, revocation, search, filtering, both themes, mobile layout, a
custom base path, and refusal of cross-site writes. Build the app and install
Chromium before running it:

```sh
pnpm build
pnpm exec playwright install chromium
HP_GUEST_BROWSER=1 pnpm test:integration tests/integration/headplane/guest-browser.test.ts
```

Set `HP_GUEST_SCREENSHOTS` to an output directory to capture light, dark, and
mobile views during that scenario. All browser data and services are isolated
from existing installations.

For manual testing, use a separate Headplane data directory and a disposable
Headscale from the [test harness](https://github.com/tale/headplane/tree/main/tests).
Create a draft, refresh the page, search and filter it, change its requested
duration, then revoke it. Open the same draft in two tabs to check stale edits.
Repeat with light and dark themes and a narrow viewport. Sign in as a viewer or
IT administrator and verify that direct guest URLs and submissions are refused.

## Resource and Headscale extensions

Resource selection is deferred. Every request currently displays zero associated
resources; no selected resource is presented as reachable. A later phase should
audit node identity, address changes, ACL/grant support across Headscale versions,
and how generated rules coexist with operator-owned policy before adding storage.

The proposed model is a separate request-resource relation with a stable
Headscale machine ID, an optional descriptive alias or destination address,
explicit TCP/UDP protocol and validated port ranges, requested validity bounds,
and a provisioning state such as unprovisioned, provisioning, provisioned, failed,
or revoked. Requested selectors must remain separate from effective provisioned
rules and their audit records. A machine name or IP alone is insufficient as
identity, and selecting a row must never grant access implicitly.

Future invitation delivery, activation, effective expiration, identity binding,
and ACL provisioning need separate services and explicit success/failure
transitions. The reserved timestamps and statuses provide an extension point;
they are not an implementation of those features. No scheduler or cleanup
process is included in phase 1.
