# Testing

Headplane has two test suites. Both run with [Vitest](https://vitest.dev).

| Command                 | What it runs                                          | Needs  |
| ----------------------- | ----------------------------------------------------- | ------ |
| `pnpm test:unit`        | `tests/unit`, in a couple of seconds                  | Node   |
| `pnpm test:integration` | `tests/integration`, against real Headscale and nodes | Docker |
| `pnpm harness up`       | A seeded tailnet that keeps running until you stop it | Docker |

Every test should be able to fail because of a regression you can name. Tests
that only restate the code, or check that something exists, get deleted. See
`AGENTS.md` for the full rules.

## Unit tests

Unit tests use Headplane's real code wherever it's cheap to: the real auth
service on an in-memory SQLite database, the real Headscale API client, and real
route loaders and actions. Two helpers in `tests/support` make that possible.

`createTestApp()` builds the same app context production does, around a fake
Headscale. Sign in as any role and call a route the way React Router would:

```ts
import { action } from "~/routes/settings/auth-keys/overview";

import { createTestApp, statusOf } from "../../support/app";

test("a viewer can't create a tag-only key", async () => {
  await using app = await createTestApp();
  const { cookie } = await app.signIn("viewer");

  const result = await app.call(action, "/settings/auth-keys", {
    as: cookie,
    form: { intent: "create", tags: "tag:prod", expiry: "90" },
  });

  expect(statusOf(result)).toBe(403);
});
```

`createFakeHeadscale(version)` is an in-memory Headscale that answers at the
HTTP level, so Headplane's own API client runs against it unchanged. It copies
real Headscale's responses for each supported version, including their quirks.

### The Headscale contract

The fake is only useful if it behaves like the real thing. `tests/contract/headscale.ts`
describes what Headplane relies on from Headscale's API. The same suite runs
against the fake in the unit tests and against real Headscale in the
integration tests, so the two can't drift apart. When the fake needs a new
behavior, add it to the contract first and check it against real Headscale.

## Integration tests

Integration tests run against real containers through the harness in
`tests/harness`. It starts disposable tailnets built on
[Testcontainers](https://testcontainers.com), and works with Docker, Podman,
Colima, and OrbStack.

```ts
import { createTailnet } from "../../harness/tailnet";

test("peers see a renamed machine", async () => {
  await using tailnet = await createTailnet({ policy: allowAll });
  const web = await tailnet.node({ name: "web", user: "alice@", ssh: true });
  const db = await tailnet.node({ name: "db", user: "alice@" });

  const app = await tailnet.headplane();
  // ...rename web through Headplane, then read db's `tailscale status`
});
```

Each tailnet has its own Docker network, a Headscale served over HTTPS with a
generated certificate, and Tailscale nodes that join with pre-auth keys. A node
can advertise routes, an exit node, tags, or SSH. `node.down()` and `node.up()`
switch it off and on. `tailnet.pendingNode()` starts one that waits for
interactive registration, and `tailnet.headplane()` runs Headplane in-process
against the tailnet.

The supported Headscale versions live in `tests/harness/versions.ts`. Locally,
integration tests run against the latest one. Set
`HP_HEADSCALE_VERSIONS=all` (as CI does) or a comma-separated list to run
others.

## Scenarios

A scenario is a seeded tailnet described as data: users, machines, routes, a
policy, and DNS settings. They live in `tests/harness/scenarios`.

```sh
pnpm harness list
pnpm harness up homelab --headplane
pnpm harness up fleet --version 0.28.0   # HP_FLEET_SIZE=200 for more machines
```

`up` prints the Headscale URL and API key and keeps everything running until
you press Ctrl-C. With `--headplane` it also starts the dev server against it on
port 3001. Use scenarios to try a change by hand, to reproduce a setup from a
bug report, and to take the screenshots in these docs.
