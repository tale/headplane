import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { aclAction } from "~/routes/acls/acl-action";
import { aclLoader } from "~/routes/acls/acl-loader";

import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { GRANT_METADATA_VERSIONS, LATEST_HEADSCALE, testedVersions } from "../../harness/versions";
import { waitFor } from "../../harness/wait";
import { statusOf } from "../../support/app";

const ALLOW_ALL = '{"acls":[{"action":"accept","src":["*"],"dst":["*:*"]}]}';

describe("the ACL policy on a real tailnet", () => {
  let tailnet: Tailnet;
  let save: (policy: string) => Promise<unknown>;

  beforeAll(async () => {
    tailnet = await createTailnet({ policy: ALLOW_ALL });
    const app = await tailnet.headplane();
    const { cookie } = await app.signIn("owner");
    save = (policy) =>
      app.call(aclAction, "/acls", { as: cookie, form: { intent: "save", policy } });
  });

  afterAll(async () => {
    await tailnet?.dispose();
  });

  test("machines stop seeing each other once a saved policy separates them", async () => {
    await tailnet.user("alice@");
    await tailnet.user("bob@");
    const web = await tailnet.node({ name: "web", user: "alice@" });
    const db = await tailnet.node({ name: "db", user: "bob@" });

    const peers = async (node: typeof db) =>
      Object.values(((await node.status()).Peer ?? {}) as Record<string, { HostName: string }>).map(
        (peer) => peer.HostName,
      );

    await waitFor("db to see web", async () => expect(await peers(db)).toContain("web"));

    const policy = '{"acls":[{"action":"accept","src":["alice@"],"dst":["alice@:*"]}]}';
    expect(statusOf(await save(policy))).toBe(200);

    await waitFor("db to lose web", async () => expect(await peers(db)).not.toContain("web"));
    expect(await peers(web)).not.toContain("db");
  });

  test("a syntax error is reported where it is, keeping the old policy", async () => {
    const before = await tailnet.api.policy.get();

    const result = await save('{"acls": [');

    expect(statusOf(result)).toBe(400);
    expect(result).toMatchObject({
      data: { errors: { form: expect.stringMatching(/^Syntax error: .* at line 1, column 11$/) } },
    });
    expect(await tailnet.api.policy.get()).toEqual(before);
  });

  test("a policy Headscale rejects comes back with its reason, keeping the old policy", async () => {
    const before = await tailnet.api.policy.get();

    const result = await save('{"acls":[{"action":"accept","src":["group:ops"],"dst":["*:*"]}]}');

    expect(statusOf(result)).toBe(400);
    expect(result).toMatchObject({
      data: { errors: { form: expect.stringContaining('"group:ops"') } },
    });
    expect(await tailnet.api.policy.get()).toEqual(before);
  });
});

describe.for(testedVersions())("where Headscale %s keeps the policy", (version) => {
  async function open(options: Parameters<typeof createTailnet>[0]) {
    const tailnet = await createTailnet({ version, ...options });
    const app = await tailnet.headplane();
    const { cookie } = await app.signIn("owner");

    return {
      tailnet,
      load: () => app.call(aclLoader, "/acls", { as: cookie }),
      save: (policy: string) =>
        app.call(aclAction, "/acls", { as: cookie, form: { intent: "save", policy } }),
    };
  }

  test("a new database policy is empty and editable", async () => {
    const { tailnet, load } = await open({});
    await using _ = tailnet;

    expect(await load()).toMatchObject({ policy: "", writable: true });
  });

  test("a policy file is shown read-only and can't be saved", async () => {
    const file = '// from disk\n{"acls":[]}';
    const { tailnet, load, save } = await open({ policyFile: file });
    await using _ = tailnet;

    expect(await load()).toMatchObject({ policy: file, writable: false });

    const result = await save(ALLOW_ALL);
    expect(statusOf(result)).toBe(403);
    expect(result).toMatchObject({
      data: { errors: { form: expect.stringContaining("The ACL policy is read-only.") } },
    });

    const path = join(dirname(tailnet.server.configPath), "policy.json");
    expect(await readFile(path, "utf8")).toBe(file);
  });

  test("grants save, or are refused with the Headscale version they need", async () => {
    const { tailnet, save } = await open({});
    await using _ = tailnet;

    const result = await save('{"grants":[{"src":["*"],"dst":["*"],"ip":["*"]}]}');

    if (tailnet.headscale.capabilities.policySupportsGrants) {
      expect(statusOf(result)).toBe(200);
      return;
    }

    expect(statusOf(result)).toBe(400);
    expect(result).toMatchObject({
      data: { errors: { form: expect.stringContaining("Grants need Headscale 0.29 or newer.") } },
    });
  });

  // Headscale's default configuration.
  test("file mode without a file is read-only rather than an empty editable policy", async () => {
    const { tailnet, load } = await open({
      headscaleConfig: { policy: { mode: "file", path: "" } },
    });
    await using _ = tailnet;

    expect(await load()).toMatchObject({ policy: "", writable: false });
  });
});

// Run the patch boundary only in the latest-version job, not once per matrix entry.
if (testedVersions().includes(LATEST_HEADSCALE)) {
  for (const version of Object.values(GRANT_METADATA_VERSIONS)) {
    const supportsMetadata = version === GRANT_METADATA_VERSIONS.first;

    test(`grant descriptions are ${supportsMetadata ? "saved" : "rejected"} on Headscale ${version}`, async () => {
      await using tailnet = await createTailnet({ version });
      const app = await tailnet.headplane();
      const { cookie } = await app.signIn("owner");
      const load = () => app.call(aclLoader, "/acls", { as: cookie });
      const save = (policy: string) =>
        app.call(aclAction, "/acls", { as: cookie, form: { intent: "save", policy } });

      const acls = [
        { action: "accept", src: ["*"], dst: ["*:443"], "#description": "Allow HTTPS" },
      ];
      const grant = {
        src: ["*"],
        dst: ["*"],
        app: { "example.com/cap/web": [{ "#description": "Part of the app payload" }] },
      };
      const original = JSON.stringify({ acls, grants: [grant] });
      expect(statusOf(await save(original))).toBe(200);
      expect(await load()).toMatchObject({
        canEditGrants: true,
        canEditGrantDescriptions: supportsMetadata,
        policy: original,
      });

      const described = JSON.stringify({
        acls,
        grants: [{ ...grant, "#description": "Why web access is granted" }],
      });
      const result = await save(described);
      if (supportsMetadata) {
        expect(statusOf(result)).toBe(200);
        expect(await load()).toMatchObject({ policy: described });
        expect(statusOf(await save(original))).toBe(200);
        expect(await load()).toMatchObject({ policy: original });
      } else {
        expect(statusOf(result)).toBe(400);
        expect(result).toMatchObject({
          data: { errors: { form: expect.stringContaining("need Headscale 0.29.4 or newer") } },
        });
        expect(await load()).toMatchObject({ policy: original });
      }
    });
  }
}
