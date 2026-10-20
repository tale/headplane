import { chmod, readFile } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { restrictionAction } from "~/routes/settings/restrictions/actions";

import { HEADSCALE_OIDC, startTailnetDex } from "../../harness/dex";
import { HARNESS_LABEL } from "../../harness/headscale";
import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { testedVersions } from "../../harness/versions";
import { statusOf, type TestApp } from "../../support/app";

describe.for(testedVersions())("sign-in restrictions on Headscale %s", (version) => {
  let tailnet: Tailnet;
  let dex: Awaited<ReturnType<typeof startTailnetDex>>;
  let app: TestApp;
  let owner: string;

  beforeAll(async () => {
    tailnet = await createTailnet({ version, headscaleConfig: HEADSCALE_OIDC });
    dex = await startTailnetDex(tailnet);

    app = await tailnet.headplane({
      config: {
        integration: {
          docker: {
            enabled: true,
            container_label: `${HARNESS_LABEL}=${tailnet.id}`,
            socket: process.env.DOCKER_HOST ?? "unix:///var/run/docker.sock",
          },
        },
      },
    });

    owner = (await app.signIn("owner")).cookie;
  });

  afterAll(async () => {
    await dex?.stop();
    await tailnet?.dispose();
  });

  function restriction(form: Record<string, string>) {
    return app.call(restrictionAction, "/settings/restrictions", { as: owner, form });
  }

  async function expectRefused(name: string, email: string) {
    const pending = await tailnet.pendingNode({ name });
    const result = await dex.signIn(pending.registerUrl, email);

    expect(result.status).toBe(401);
    expect((await tailnet.api.nodes.list()).map((node) => node.name)).not.toContain(name);
    await pending.stop();
  }

  async function expectAdmitted(name: string, email: string) {
    const pending = await tailnet.pendingNode({ name });
    const result = await dex.signIn(pending.registerUrl, email);

    expect(result.status).toBe(200);
    const node = await pending.joined();
    expect((await node.machine()).user?.email).toBe(email);
  }

  test("a read-only Headscale config can't be changed", async () => {
    const before = await readFile(tailnet.server.configPath, "utf8");
    await chmod(tailnet.server.configPath, 0o444);
    const readOnly = await tailnet.headplane();
    await chmod(tailnet.server.configPath, 0o644);

    const { cookie } = await readOnly.signIn("owner");
    const result = await readOnly.call(restrictionAction, "/settings/restrictions", {
      as: cookie,
      form: { intent: "add", type: "domain", value: "allowed.test" },
    });

    expect(statusOf(result)).toBe(403);
    expect(result).toMatchObject({
      data: { errors: { form: "The Headscale configuration is read-only." } },
    });
    expect(await readFile(tailnet.server.configPath, "utf8")).toBe(before);
  });

  test("removing a restriction that isn't there says so", async () => {
    const result = await restriction({ intent: "remove", type: "user", value: "nobody@x.test" });

    expect(statusOf(result)).toBe(400);
    expect(result).toMatchObject({ data: { errors: { form: "This user isn't in the list." } } });
  });

  test("a domain restriction keeps other domains out until it's removed", async () => {
    expect(
      statusOf(await restriction({ intent: "add", type: "domain", value: "allowed.test" })),
    ).toBe(200);

    await expectRefused("domain-outsider", "mallory@other.test");
    await expectAdmitted("domain-insider", "alice@allowed.test");

    expect(
      statusOf(await restriction({ intent: "remove", type: "domain", value: "allowed.test" })),
    ).toBe(200);

    await expectAdmitted("domain-returning", "mallory@other.test");
  });

  test("a user restriction lets only that user in", async () => {
    expect(
      statusOf(await restriction({ intent: "add", type: "user", value: "alice@allowed.test" })),
    ).toBe(200);

    await expectRefused("user-outsider", "mallory@other.test");
    await expectAdmitted("user-insider", "alice@allowed.test");
  });
});
