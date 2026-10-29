import { readFile } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { action as edit, loader as detail } from "~/routes/guests/detail";
import { action as create, loader as list } from "~/routes/guests/overview";
import type { GuestResult } from "~/server/guests";
import { Roles, type Role } from "~/server/web/roles";

import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { testedVersions } from "../../harness/versions";
import { statusOf, type TestApp } from "../../support/app";

function value<T>(result: GuestResult<T>) {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function createdId(result: unknown): string {
  if (
    result &&
    typeof result === "object" &&
    "data" in result &&
    result.data &&
    typeof result.data === "object" &&
    "id" in result.data &&
    typeof result.data.id === "string"
  )
    return result.data.id;
  throw new Error("Expected a successful guest creation");
}

describe.for(testedVersions())("guest management beside Headscale %s", (version) => {
  let tailnet: Tailnet;
  let app: TestApp;
  const cookies = new Map<Role, string>();

  beforeAll(async () => {
    tailnet = await createTailnet({
      version,
      policy: '{"acls":[{"action":"accept","src":["*"],"dst":["*:*"]}]}',
    });
    app = await tailnet.headplane();
    for (const role of Object.keys(Roles) as Role[])
      cookies.set(role, (await app.signIn(role)).cookie);
  });
  afterAll(async () => {
    await tailnet?.dispose();
  });

  test("an administrator can create, find, edit and revoke a persisted draft without changing Headscale", async () => {
    const as = cookies.get("admin");
    const before = {
      policy: await tailnet.api.policy.get(),
      users: await tailnet.api.users.list(),
      nodes: await tailnet.api.nodes.list(),
      config: await readFile(tailnet.server.configPath, "utf8"),
    };
    const form = {
      intent: "create",
      email: " Scenario@Example.com ",
      display_name: "Scenario guest",
      notes: "Planning only",
      duration: "604800",
      status: "active",
    };
    const created = await app.call(create, "/guests", { as, form });
    expect(statusOf(created)).toBe(200);
    const id = createdId(created);
    const stored = value(app.ctx.guests.get(id));
    const admin = (await app.ctx.auth.listUsers()).find((user) => user.role === "admin")!;
    expect(stored).toMatchObject({
      status: "draft",
      email: "scenario@example.com",
      created_by: admin.id,
      activated_at: null,
      expires_at: null,
    });
    expect(
      await app.call(list, "/guests", { as, search: "?q=SCENARIO%40&status=draft" }),
    ).toMatchObject({ rows: [stored], total: 1 });
    expect(await app.call(detail, `/guests/${id}`, { as, params: { id } })).toMatchObject({
      guest: stored,
    });

    expect(
      statusOf(
        await app.call(edit, `/guests/${id}`, {
          as,
          params: { id },
          form: {
            ...form,
            intent: "update",
            revision: "1",
            display_name: "Updated guest",
            duration: "172800",
          },
        }),
      ),
    ).toBe(200);
    expect(value(app.ctx.guests.get(id))).toMatchObject({
      display_name: "Updated guest",
      requested_duration_seconds: 172800,
      revision: 2,
    });
    expect(
      statusOf(
        await app.call(edit, `/guests/${id}`, {
          as,
          params: { id },
          form: { intent: "revoke", revision: "1" },
        }),
      ),
    ).toBe(409);
    expect(
      statusOf(
        await app.call(edit, `/guests/${id}`, {
          as,
          params: { id },
          form: { intent: "revoke", revision: "2" },
        }),
      ),
    ).toBe(200);
    expect(
      statusOf(
        await app.call(edit, `/guests/${id}`, {
          as,
          params: { id },
          form: { ...form, intent: "update", revision: "3" },
        }),
      ),
    ).toBe(409);
    expect(value(app.ctx.guests.get(id))).toMatchObject({
      status: "revoked",
      revision: 3,
      activated_at: null,
      expires_at: null,
    });
    expect(
      await app.call(list, "/guests", { as, search: "?q=scenario%40&status=draft" }),
    ).toMatchObject({ rows: [], total: 0 });
    expect(await tailnet.api.policy.get()).toEqual(before.policy);
    expect(await tailnet.api.users.list()).toEqual(before.users);
    expect(await tailnet.api.nodes.list()).toEqual(before.nodes);
    expect(await readFile(tailnet.server.configPath, "utf8")).toBe(before.config);
  });

  test.for(["network_admin", "it_admin", "auditor", "viewer", "member"] as const)(
    "%s cannot read guests or submit any guest operation",
    async (role) => {
      const guest = value(
        app.ctx.guests.create({ email: `boundary-${role}@example.com`, duration: "86400" }, null),
      );
      const as = cookies.get(role);
      const path = `/guests/${guest.id}`;
      const params = { id: guest.id };
      expect(statusOf(await app.call(list, "/guests", { as }))).toBe(403);
      expect(statusOf(await app.call(detail, path, { as, params }))).toBe(403);
      expect(
        statusOf(
          await app.call(create, "/guests", {
            as,
            form: { intent: "create", email: `${role}@example.com`, duration: "86400" },
          }),
        ),
      ).toBe(403);
      for (const intent of ["update", "revoke"]) {
        expect(
          statusOf(
            await app.call(edit, path, {
              as,
              params,
              form: { intent, revision: "1", email: "changed@example.com", duration: "86400" },
            }),
          ),
        ).toBe(403);
      }
      expect(value(app.ctx.guests.get(guest.id))).toEqual(guest);
    },
  );

  test("owner and API key sessions retain administrative access and API keys are never stored with guests", async () => {
    for (const as of [cookies.get("owner"), (await app.signInWithApiKey()).cookie]) {
      const result = await app.call(create, "/guests", {
        as,
        form: { intent: "create", email: "administrative@example.com", duration: "86400" },
      });
      expect(statusOf(result)).toBe(200);
      const guest = value(app.ctx.guests.get(createdId(result)));
      expect(JSON.stringify(guest)).not.toContain(tailnet.server.apiKey);
      expect(statusOf(await app.call(list, "/guests", { as }))).toBe(200);
    }
  });

  test("invalid fields, fabricated activation intents and missing guests return form or page errors", async () => {
    const as = cookies.get("admin");
    const bad = await app.call(create, "/guests", {
      as,
      form: { intent: "create", email: "invalid", duration: "3600" },
    });
    expect(statusOf(bad)).toBe(400);
    expect(bad).toMatchObject({
      data: { errors: { email: expect.any(String), duration: expect.any(String) } },
    });
    expect(statusOf(await app.call(create, "/guests", { as, form: { intent: "activate" } }))).toBe(
      400,
    );
    expect(
      statusOf(await app.call(detail, "/guests/invalid", { as, params: { id: "invalid" } })),
    ).toBe(404);
    expect(
      statusOf(
        await app.call(edit, "/guests/missing", {
          as,
          params: { id: "missing" },
          form: { intent: "revoke", revision: "1" },
        }),
      ),
    ).toBe(404);
    expect(await app.call(list, "/guests", { as, search: "?status=active&page=-1" })).toMatchObject(
      { queryError: expect.any(String), query: { status: "all", page: 1 } },
    );
  });
});
