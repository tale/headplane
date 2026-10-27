# Testing

Headplane has two test suites. Both run with [Vitest](https://vitest.dev).

| Command                 | What it runs                                          | Needs  |
| ----------------------- | ----------------------------------------------------- | ------ |
| `pnpm test:unit`        | `tests/unit`, in about a second                       | Node   |
| `pnpm test:integration` | `tests/integration`, against real Headscale and nodes | Docker |
| `pnpm harness up`       | A seeded tailnet that keeps running until you stop it | Docker |

Every test should be able to fail because of a regression you can name. Tests
that only restate the code, or check that something exists, get deleted. See
[`AGENTS.md`](../AGENTS.md) for the full rules.

## Unit tests

Unit tests cover the logic that doesn't need Headscale: config loading, auth
sessions, roles, parsing, and form schemas. They use real implementations
wherever they're cheap, such as the auth service on an in-memory SQLite
database. Anything that talks to Headscale runs against the real thing in the
integration tests instead of a fake or a stubbed client.

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
generated certificate and its own DERP server, and Tailscale nodes that join
with pre-auth keys. A node can advertise routes, an exit node, tags, or SSH.
`node.down()` and `node.up()` switch it off and on. `tailnet.pendingNode()`
starts one that waits for interactive registration.

Browser SSH tests in `tests/integration/ssh` build `hp_ssh.wasm` and run it in
a Node container on the tailnet's network, standing in for the browser
(`tests/harness/browser-ssh.ts`). It joins and opens a session the same way the
page does, so they catch problems in the WebAssembly client, Headscale's
WebSocket and DERP handling, and the SSH rules.

`tailnet.headplane()` runs Headplane in-process against the tailnet, built from
the same app context production uses. Sign in as any role and call a route the
way React Router would:

```ts
import { action } from "~/routes/settings/auth-keys/overview";

import { statusOf } from "../../support/app";

test("a viewer can't create a tag-only key", async () => {
  await using tailnet = await createTailnet();
  const app = await tailnet.headplane();
  const { cookie } = await app.signIn("viewer");

  const result = await app.call(action, "/settings/auth-keys", {
    as: cookie,
    form: { intent: "create", tags: "tag:prod", expiry: "90" },
  });

  expect(statusOf(result)).toBe(403);
});
```

`tests/integration/headscale/contract.test.ts` describes what Headplane relies
on from Headscale's API, including the quirks of each version, and checks it
through Headplane's own client. `permissions.test.ts` calls every route as each
role, so a new route is covered as soon as it's added.

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
port 3001. Use scenarios to try a change by hand, or to reproduce a setup from a
bug report.

## Docs screenshots

`pnpm harness screenshots` seeds the `homelab` scenario, builds Headplane with
the agent and Browser SSH, signs in through Dex as each person, and saves light
and dark screenshots to `docs/assets`. Install the browser once with
`pnpm exec playwright install chromium`.

Runs come out close to the same, apart from dates. Machines join in order, so
their IPs don't change, machine keys are swapped on the page, and the agent
reports each machine's `hostInfo` from the scenario instead of the Docker
host's kernel. The Browser SSH shots run `fastfetch` and `btop` live, against
fake services from `loadgen.go`. Retake them after a UI change and commit the
images with it.
