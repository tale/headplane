---
title: Database
description: Where Headplane stores its own state, and how to move it.
outline: [2, 3]
---

# Database

Headplane keeps a small amount of its own state — the users it knows about,
their roles, their link to Headscale users, and active sessions. This is
separate from Headscale's database and much smaller: a handful of rows per user.

Everything else Headplane shows you is read from Headscale on demand and never
stored.

## Default Behaviour

Without any configuration, Headplane uses SQLite at `hp_persist.db` inside
[`server.data_path`](/configuration/#configuration-file):

```yaml
server:
  data_path: "/var/lib/headplane"
  # Database at /var/lib/headplane/hp_persist.db
```

The file is created on first start and migrated automatically on upgrade. If you
are running in Docker, this is why `data_path` needs to be a mounted volume —
losing it means losing role assignments and every signed-in session.

## Choosing a Location

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
you would rather the database live somewhere with different backup or durability
settings. Headplane creates the parent directory if it does not exist.

Omitting the block entirely, or omitting `path` within it, keeps the historical
location. Upgrading never moves an existing database.

### Moving an existing database

Headplane does not relocate the file for you. Stop Headplane, move it, then
start again:

```sh
systemctl stop headplane
mv /var/lib/headplane/hp_persist.db /srv/state/headplane.db
# set server.database.path, then
systemctl start headplane
```

Moving it while Headplane is running risks losing writes. If you start Headplane
pointed at a path that does not exist, it creates an empty database — the first
person to sign in becomes the owner again, and previous role assignments are
gone. Check the path before restarting.

## Backups

The database is small enough to copy directly, but do it with Headplane stopped,
or use SQLite's backup command so you do not capture a half-written file:

```sh
sqlite3 /var/lib/headplane/hp_persist.db ".backup '/backup/headplane.db'"
```

What you lose without a backup is recoverable but tedious: every user is
recreated on next sign-in with the default role, and the first person to sign in
becomes the owner. Headscale itself is unaffected.

## Reference

| Field                    | Description                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `server.database.type`   | Database engine. Currently `sqlite`.                                                             |
| `server.database.path`   | Location of the SQLite file. Defaults to `hp_persist.db` inside `server.data_path`.              |
