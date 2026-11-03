import type { RouteConfigEntry } from "@react-router/dev/routes";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import routes from "~/routes";
import type { Role } from "~/server/web/roles";

import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { statusOf, type TestApp } from "../../support/app";

type Handler = ((args: never) => unknown) & { intents?: string[] };
interface RouteModule {
  loader?: Handler;
  action?: Handler;
}

const modules = import.meta.glob<RouteModule>("/app/{routes,layout}/**/*.{ts,tsx}");

// Everything else needs a signed-in user with dashboard access.
const PUBLIC = new Set([
  "routes/util/healthz.ts",
  "routes/util/info.ts",
  "routes/util/color-scheme.ts",
  "routes/util/redirect.ts",
  "routes/auth/login/page.tsx",
  "routes/auth/logout.ts",
  "routes/auth/oidc-start.ts",
  "routes/auth/oidc-callback.ts",
  "routes/auth/link.tsx",
  "routes/home.tsx",
]);

// Members get only access flags or change notifications from these.
const MEMBER_VISIBLE = new Set([
  "layout/app.tsx",
  "routes/settings/layout.tsx",
  "routes/util/live.ts",
]);

// Read-only roles manage their own auth keys and may refresh the agent.
const SELF_SERVICE = new Set([
  "routes/settings/auth-keys/overview.tsx",
  "routes/settings/agent.tsx",
]);

interface Entry {
  file: string;
  path: string;
  module: RouteModule;
  intent?: string;
}

async function flatten(entries: RouteConfigEntry[], parent = ""): Promise<Entry[]> {
  const flat: Entry[] = [];
  for (const entry of entries) {
    const path = entry.path ? `${parent}/${entry.path}`.replace(/\/+/g, "/") : parent;
    const load = modules[`/app/${entry.file}`];
    if (!load) throw new Error(`No module for ${entry.file}`);

    flat.push({ file: entry.file, path: path || "/", module: await load() });
    flat.push(...(await flatten(entry.children ?? [], path)));
  }

  return flat;
}

const guarded = (await flatten(await routes)).filter((entry) => !PUBLIC.has(entry.file));
const loaders = guarded.filter((entry) => entry.module.loader);
const actions = guarded
  .filter((entry) => entry.module.action)
  .flatMap((entry) =>
    (entry.module.action!.intents ?? [undefined]).map((intent) => ({ ...entry, intent })),
  );

const label = (entry: Entry) => `${entry.file} ${entry.intent ?? ""}`.trim();

describe("route permissions", () => {
  let tailnet: Tailnet;
  let app: TestApp;
  let form: Record<string, string>;
  const cookies = new Map<Role, string>();

  beforeAll(async () => {
    tailnet = await createTailnet();
    app = await tailnet.headplane();

    for (const role of ["owner", "member", "viewer", "auditor"] as const) {
      cookies.set(role, (await app.signIn(role)).cookie);
    }

    // Valid enough for every intent, so checks inside handlers run too. The
    // machine belongs to a Headscale user none of the test users are.
    const other = await tailnet.user("someone-else@");
    const node = await tailnet.node({ name: "theirs", user: other.name, routes: ["10.0.0.0/24"] });
    form = {
      node_id: node.id,
      user_id: other.id,
      headscale_user_id: other.id,
      name: "renamed",
      tags: "tag:web",
      routes: "10.0.0.0/24",
      enabled: "true",
      disable_expiry: "true",
      expiry: "30",
    };
  });

  afterAll(async () => {
    await tailnet?.dispose();
  });

  function callAction(entry: Entry, as?: string) {
    return app.call(entry.module.action!, entry.path, {
      as,
      form: { ...form, ...(entry.intent ? { intent: entry.intent } : {}) },
      params: { id: form.node_id },
    });
  }

  test("every guarded route is covered", () => {
    expect(loaders.length).toBeGreaterThan(5);
    expect(actions.filter((entry) => entry.intent).length).toBeGreaterThan(10);
  });

  test.for(loaders.map((entry) => [label(entry), entry] as const))(
    "%s loader turns away signed-out users and members",
    async ([, entry]) => {
      const callers = MEMBER_VISIBLE.has(entry.file) ? [undefined] : [undefined, "member" as const];
      for (const role of callers) {
        const result = await app.call(entry.module.loader!, entry.path, {
          as: role && cookies.get(role),
          params: { id: form.node_id },
        });

        expect(statusOf(result), role ?? "signed out").not.toBe(200);
      }
    },
  );

  test.for(actions.map((entry) => [label(entry), entry] as const))(
    "%s is refused to signed-out users and read-only roles",
    async ([, entry]) => {
      const readOnly: Role[] = SELF_SERVICE.has(entry.file)
        ? ["member"]
        : ["member", "viewer", "auditor"];

      expect(statusOf(await callAction(entry)), "signed out").not.toBe(200);
      for (const role of readOnly) {
        expect(statusOf(await callAction(entry, cookies.get(role))), role).toBe(403);
      }
    },
  );

  test.for(actions.map((entry) => [label(entry), entry] as const))(
    "%s is open to the owner",
    async ([, entry]) => {
      expect(statusOf(await callAction(entry, cookies.get("owner")))).not.toBe(403);
    },
  );
});
