---
title: Database
description: Where Headplane stores its own state, and how to move it.
---

# Database

Headplane keeps a small amount of its own state: the accounts it knows about,
their roles, their link to Headscale users, and active sessions. This is
separate from Headscale's database and much smaller, a handful of rows per
account. Everything else Headplane shows is read from Headscale on demand and
never stored.

## Default behaviour

Without any configuration, Headplane uses SQLite at `hp_persist.db` inside
[`server.data_path`](/configuration#data-directory):

```yaml
server:
  data_path: "/var/lib/headplane"
  # Database at /var/lib/headplane/hp_persist.db
```

The file is created on first start and migrated automatically on upgrade. In
Docker, this is why `data_path` needs to be a mounted volume: losing it means
losing role assignments and every signed-in session.

## Choosing a location

Set `server.database.path` to keep the database somewhere other than
`data_path`:

```yaml
server:
  data_path: "/var/lib/headplane"
  database:
    type: "sqlite"
    path: "/srv/state/headplane.db"
```

This is useful when `data_path` sits on a volume chosen for cache-like data and
the database belongs somewhere with different backup or durability settings.
Headplane creates the parent directory if it does not exist.

Omitting the block entirely, or omitting `path` within it, keeps the historical
location. Upgrading never moves an existing database.

### Moving an existing database

Headplane does not relocate the file. Stop Headplane, move it, then start again:

```sh
systemctl stop headplane
mv /var/lib/headplane/hp_persist.db /srv/state/headplane.db
# set server.database.path, then
systemctl start headplane
```

Moving it while Headplane is running risks losing writes. Starting Headplane
pointed at a path that does not exist creates an empty database: the first
person to sign in becomes the owner again, and previous role assignments are
gone. Check the path before restarting.

## PostgreSQL

Headplane can store its state in PostgreSQL instead. This is worth doing when
Headplane runs somewhere without durable local storage, when more than one
Headplane replica runs, or when a PostgreSQL server already exists for Headscale
and backing up one database is preferable to two.

```yaml
server:
  database:
    type: "postgres"
    url: "postgres://headplane@10.0.0.5:5432/headplane"
```

Or give the parts separately:

```yaml
server:
  database:
    type: "postgres"
    host: "10.0.0.5"
    port: 5432
    name: "headplane"
    user: "headplane"
    password_path: "/run/secrets/headplane-db-password"
    ssl_mode: "require"
    max_connections: 10
```

Headplane creates and migrates its own tables on start. Point it at a database
it owns rather than sharing Headscale's: the table names are generic enough to
collide, and Headplane's migrations assume it is the only writer.

:::note
Prefer `password_path` over `password`. It reads the password from a file,
following the same convention as `headscale.api_key_path`, and keeps the
credential out of the configuration file.
:::

### TLS

| `ssl_mode`    | Behaviour                                                          |
| ------------- | ------------------------------------------------------------------ |
| `disable`     | No encryption.                                                     |
| `require`     | Encrypts, but does not verify the server certificate. The default. |
| `verify-full` | Encrypts and verifies the server certificate.                      |

`require` is the default because it is what most managed providers work with
out of the box. Prefer `verify-full` when the provider supplies a CA to verify
against.

### Moving from SQLite to PostgreSQL

Pointing an instance at an empty PostgreSQL database gives an empty Headplane:
the first person to sign in becomes the owner, and previous role assignments
are gone. Copy the existing data across first.

Stop Headplane before copying, since reading a live database can capture a
half-written state.

```sh
pnpm exec tsx scripts/db-copy.ts \
  --from /var/lib/headplane/hp_persist.db \
  --to postgres://headplane@10.0.0.5:5432/headplane
```

Pass `--dry-run` first to see what would be copied without writing anything.
The target is created and migrated automatically, so it can be an empty
database.

The copy carries accounts, their roles and their Headscale links, live
sessions, and cached node information. Expired sessions are dropped rather than
copied. Signed-in people stay signed in, since sessions come across and the
cookie secret has not changed.

It refuses to run against a target that already holds accounts, so a repeated
run cannot half-merge two databases. Pass `--allow-nonempty` when merging is
intended.

:::warning
If the copy reports that the source has more than one owner, demote all but one
before retrying. PostgreSQL enforces a single owner and the copy stops rather
than failing partway through.
:::

Once the copy succeeds, switch `server.database` over and start Headplane. Keep
the SQLite file until everything has been confirmed to look right; nothing
deletes it.

## Backups

The database is small enough to copy directly, but do it with Headplane
stopped, or use SQLite's backup command to avoid capturing a half-written file:

```sh
sqlite3 /var/lib/headplane/hp_persist.db ".backup '/backup/headplane.db'"
```

What is lost without a backup is recoverable but tedious: every account is
recreated on next sign-in with the default role, and the first person to sign
in becomes the owner. Headscale itself is unaffected.

## Reference

| Field                             | Description                                                            |
| --------------------------------- | ---------------------------------------------------------------------- |
| `server.database.type`            | `sqlite` (default) or `postgres`.                                      |
| `server.database.path`            | SQLite only. Defaults to `hp_persist.db` inside `server.data_path`.    |
| `server.database.url`             | PostgreSQL connection string. Replaces the host/port/name/user fields. |
| `server.database.host`            | PostgreSQL host, when not using `url`.                                 |
| `server.database.port`            | PostgreSQL port. Defaults to `5432`.                                   |
| `server.database.name`            | PostgreSQL database name, when not using `url`.                        |
| `server.database.user`            | PostgreSQL user, when not using `url`.                                 |
| `server.database.password`        | PostgreSQL password. Prefer `password_path`.                           |
| `server.database.password_path`   | Reads the password from a file instead.                                |
| `server.database.ssl_mode`        | `disable`, `require` (default) or `verify-full`.                       |
| `server.database.max_connections` | Connection pool size. Defaults to `10`.                                |
