import { chmod, readFile } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { parse, stringify } from "yaml";

import { dnsAction } from "~/routes/dns/dns-actions";
import { loader } from "~/routes/dns/overview";

import { HARNESS_LABEL } from "../../harness/headscale";
import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { testedVersions } from "../../harness/versions";
import { waitFor } from "../../harness/wait";
import { createTestApp, statusOf, type TestApp } from "../../support/app";
import { tempFile } from "../../support/temp";

const ALLOW_ALL_ACL_POLICY = { acls: [{ action: "accept", src: ["*"], dst: ["*:*"] }] };

function errorsOf(result: unknown) {
  return (result as { data: { errors?: Record<string, string> } }).data.errors;
}

describe("DNS settings", () => {
  let tailnet: Tailnet;
  let app: TestApp;
  let owner: string;

  // No integration, so changes are only written to Headscale's config.
  beforeAll(async () => {
    tailnet = await createTailnet();
    app = await tailnet.headplane();
    owner = (await app.signIn("owner")).cookie;
  });

  afterAll(async () => {
    await tailnet?.dispose();
  });

  function dns(form: Record<string, string>) {
    return app.call(dnsAction, "/dns", { as: owner, form });
  }

  async function written() {
    return parse(await readFile(tailnet.server.configPath, "utf8")).dns;
  }

  test("nameservers can be added, reordered and removed", async () => {
    expect(statusOf(await dns({ intent: "add_ns", nameserver: " 9.9.9.9 " }))).toBe(200);
    expect(statusOf(await dns({ intent: "move_ns", nameserver: "9.9.9.9", direction: "up" }))).toBe(
      200,
    );
    expect((await written()).nameservers.global).toEqual(["9.9.9.9", "1.1.1.1"]);

    expect(statusOf(await dns({ intent: "remove_ns", nameserver: "1.1.1.1" }))).toBe(200);
    expect((await written()).nameservers.global).toEqual(["9.9.9.9"]);
    expect(await app.call(loader, "/dns", { as: owner })).toMatchObject({
      nameservers: ["9.9.9.9"],
    });
  });

  test.for([
    { nameserver: "9.9.9.9", error: "This nameserver is already in the list." },
    { nameserver: "dns.example.com", error: "Enter an IPv4 or IPv6 address." },
  ])("refuses $nameserver as a nameserver", async ({ nameserver, error }) => {
    await dns({ intent: "add_ns", nameserver: "9.9.9.9" });
    const before = await written();

    const result = await dns({ intent: "add_ns", nameserver });
    expect(statusOf(result)).toBe(400);
    expect(errorsOf(result)).toEqual({ nameserver: error });
    expect(await written()).toEqual(before);
  });

  test("a split DNS domain goes away with its last nameserver", async () => {
    const split = { intent: "add_ns", split_domain: "corp.example" };
    await dns({ ...split, nameserver: "10.0.0.53" });
    await dns({ ...split, nameserver: "10.0.0.54" });
    expect((await written()).nameservers.split).toEqual({
      "corp.example": ["10.0.0.53", "10.0.0.54"],
    });

    const remove = { intent: "remove_ns", split_domain: "corp.example" };
    await dns({ ...remove, nameserver: "10.0.0.53" });
    await dns({ ...remove, nameserver: "10.0.0.54" });
    expect((await written()).nameservers.split).toEqual({});
  });

  test("search domains can be added, reordered and removed", async () => {
    await dns({ intent: "add_domain", domain: "corp.example" });
    await dns({ intent: "add_domain", domain: "lab.example" });
    await dns({ intent: "move_domain", domain: "lab.example", direction: "up" });
    expect((await written()).search_domains).toEqual(["lab.example", "corp.example"]);

    const duplicate = await dns({ intent: "add_domain", domain: "corp.example" });
    expect(errorsOf(duplicate)).toEqual({ domain: "This search domain is already in the list." });

    await dns({ intent: "remove_domain", domain: "lab.example" });
    expect((await written()).search_domains).toEqual(["corp.example"]);
  });

  // A page left open elsewhere can ask for an item that's already gone.
  test.for<Record<string, string>>([
    {
      intent: "remove_ns",
      nameserver: "192.0.2.1",
      error: "This nameserver isn't in the list anymore.",
    },
    {
      intent: "move_ns",
      nameserver: "192.0.2.1",
      direction: "up",
      error: "This nameserver isn't in the list anymore.",
    },
    {
      intent: "remove_domain",
      domain: "gone.example",
      error: "This search domain isn't in the list anymore.",
    },
    {
      intent: "move_domain",
      domain: "gone.example",
      direction: "up",
      error: "This search domain isn't in the list anymore.",
    },
    {
      intent: "move_domain",
      domain: "corp.example",
      direction: "down",
      error: "This search domain is already at the bottom.",
    },
    {
      intent: "remove_record",
      type: "A",
      name: "gone.tailnet.test",
      error: "This record isn't in the list anymore.",
    },
  ])("refuses $intent of something that isn't there to change", async ({ error, ...form }) => {
    const before = await written();
    const records = await readFile(tailnet.server.recordsPath, "utf8");

    const result = await dns(form);
    expect(statusOf(result)).toBe(400);
    expect(errorsOf(result)).toEqual({ form: error });
    expect(await written()).toEqual(before);
    expect(await readFile(tailnet.server.recordsPath, "utf8")).toBe(records);
  });

  // Headscale refuses to start when it overrides local DNS without one.
  test("keeps a global nameserver while overriding local DNS", async () => {
    const [last, ...others] = (await written()).nameservers.global;
    for (const nameserver of others) await dns({ intent: "remove_ns", nameserver });

    const removed = await dns({ intent: "remove_ns", nameserver: last });
    expect(errorsOf(removed)).toEqual({
      form: "Overriding local DNS needs a global nameserver. Turn off the override first.",
    });
    expect((await written()).nameservers.global).toEqual([last]);

    expect(statusOf(await dns({ intent: "override_dns", enabled: "false" }))).toBe(200);
    expect(statusOf(await dns({ intent: "remove_ns", nameserver: last }))).toBe(200);
    expect(await written()).toMatchObject({
      override_local_dns: false,
      nameservers: { global: [] },
    });

    const enabled = await dns({ intent: "override_dns", enabled: "true" });
    expect(errorsOf(enabled)).toEqual({
      form: "Add a global nameserver before overriding local DNS.",
    });
    expect((await written()).override_local_dns).toBe(false);
  });

  test("a removed record leaves the others in the records file", async () => {
    await dns({ intent: "add_record", type: "A", name: "a.tailnet.test", value: "100.64.9.1" });
    await dns({ intent: "add_record", type: "AAAA", name: "a.tailnet.test", value: "fd7a::1" });
    await dns({ intent: "remove_record", type: "A", name: "a.tailnet.test" });

    expect(JSON.parse(await readFile(tailnet.server.recordsPath, "utf8"))).toEqual([
      { type: "AAAA", name: "a.tailnet.test", value: "fd7a::1" },
    ]);
  });

  test.for([
    {
      type: "A",
      name: "v4.tailnet.test",
      value: "fd7a::1",
      error: { value: "Enter an IPv4 address." },
    },
    {
      type: "AAAA",
      name: "v6.tailnet.test",
      value: "100.64.0.1",
      error: { value: "Enter an IPv6 address." },
    },
    {
      type: "CNAME",
      name: "c.tailnet.test",
      value: "a.tailnet.test",
      error: { type: "Choose a record type." },
    },
  ])("refuses a $type record of $value", async ({ type, name, value, error }) => {
    const result = await dns({ intent: "add_record", type, name, value });
    expect(statusOf(result)).toBe(400);
    expect(errorsOf(result)).toEqual(error);
  });

  test("refuses a second record of the same type for a domain", async () => {
    await dns({ intent: "add_record", type: "A", name: "dup.tailnet.test", value: "100.64.9.2" });
    const result = await dns({
      intent: "add_record",
      type: "A",
      name: "dup.tailnet.test",
      value: "100.64.9.3",
    });

    expect(errorsOf(result)).toEqual({ name: "This domain already has an A record." });
    const records = JSON.parse(await readFile(tailnet.server.recordsPath, "utf8"));
    expect(records.filter((r: { name: string }) => r.name === "dup.tailnet.test")).toEqual([
      { type: "A", name: "dup.tailnet.test", value: "100.64.9.2" },
    ]);
  });
});

describe.for(testedVersions())("DNS on Headscale %s", (version) => {
  let tailnet: Tailnet;
  let app: TestApp;
  let owner: string;

  beforeAll(async () => {
    tailnet = await createTailnet({ version, policy: ALLOW_ALL_ACL_POLICY });
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
    await tailnet?.dispose();
  });

  function dns(form: Record<string, string>) {
    return app.call(dnsAction, "/dns", { as: owner, form });
  }

  async function dnsStatus(node: Awaited<ReturnType<Tailnet["node"]>>) {
    return JSON.parse(await node.tailscale(["dns", "status", "--json"])) as {
      CurrentTailnet: { MagicDNSEnabled: boolean };
      Resolvers: Array<{ Addr: string }>;
      SplitDNSRoutes?: Record<string, Array<{ Addr: string }>>;
      SearchDomains: string[];
    };
  }

  test("a record added in Headplane reaches the machines", async () => {
    const node = await tailnet.node({ name: "dns-client", user: "alice@" });
    const result = await dns({
      intent: "add_record",
      type: "A",
      name: "intranet.tailnet.test",
      value: "100.100.1.1",
    });

    expect(statusOf(result)).toBe(200);
    await tailnet.server.reloadRecords();
    await waitFor(
      "the record in the node's netmap",
      async () => {
        const netmap = await node.tailscale(["debug", "netmap"]);
        expect(netmap).toContain("intranet.tailnet.test");
      },
      { timeout: 60_000 },
    );
  });

  test("nameservers, split DNS and search domains reach the machines", async () => {
    const node = await tailnet.node({ name: "resolver-client", user: "alice@" });

    expect(statusOf(await dns({ intent: "add_ns", nameserver: "9.9.9.9" }))).toBe(200);
    expect(
      statusOf(
        await dns({ intent: "add_ns", split_domain: "corp.example", nameserver: "10.0.0.53" }),
      ),
    ).toBe(200);
    expect(statusOf(await dns({ intent: "add_domain", domain: "corp.example" }))).toBe(200);

    await waitFor(
      "the DNS settings on the node",
      async () => {
        const status = await dnsStatus(node);
        expect(status.Resolvers.map((r) => r.Addr)).toEqual(["1.1.1.1", "9.9.9.9"]);
        expect(status.SplitDNSRoutes?.["corp.example"]).toEqual([{ Addr: "10.0.0.53" }]);
        expect(status.SearchDomains).toContain("corp.example");
      },
      { timeout: 60_000 },
    );
  });

  test("turning Magic DNS off and on reaches the machines", async () => {
    const node = await tailnet.node({ name: "magic-client", user: "alice@" });

    expect(statusOf(await dns({ intent: "toggle_magic", enabled: "false" }))).toBe(200);
    await waitFor(
      "Magic DNS off on the node",
      async () => expect((await dnsStatus(node)).CurrentTailnet.MagicDNSEnabled).toBe(false),
      { timeout: 60_000 },
    );

    expect(statusOf(await dns({ intent: "toggle_magic", enabled: "true" }))).toBe(200);
    await waitFor(
      "Magic DNS on again",
      async () => expect((await dnsStatus(node)).CurrentTailnet.MagicDNSEnabled).toBe(true),
      { timeout: 60_000 },
    );
  });

  test("renaming the tailnet restarts Headscale and reaches the machines", async () => {
    const node = await tailnet.node({ name: "renamed-client", user: "alice@" });
    const result = await dns({ intent: "rename_tailnet", name: "renamed.test" });

    expect(statusOf(result)).toBe(200);
    await waitFor(
      "the new domain on the node",
      async () => {
        const self = (await node.status()).Self as { DNSName: string };
        expect(self.DNSName).toBe("renamed-client.renamed.test.");
      },
      { timeout: 60_000 },
    );
  });
});

describe("DNS settings Headplane can't change", () => {
  async function appFor(dns: Record<string, unknown>, mode = 0o644) {
    const configPath = await tempFile("config.yaml", stringify({ dns }));
    await chmod(configPath, mode);
    const app = await createTestApp({
      headscale: { url: "http://127.0.0.1:1", apiKey: "unused" },
      config: { headscale: { config_path: configPath } },
    });

    const { cookie } = await app.signIn("owner");
    return { app, cookie, configPath };
  }

  test("a read-only Headscale config is left alone", async () => {
    const { app, cookie, configPath } = await appFor({ base_domain: "tailnet.test" }, 0o444);
    await using _ = app;
    const before = await readFile(configPath, "utf8");

    const result = await app.call(dnsAction, "/dns", {
      as: cookie,
      form: { intent: "rename_tailnet", name: "renamed.test" },
    });

    expect(statusOf(result)).toBe(403);
    expect(errorsOf(result)).toEqual({ form: "The Headscale configuration is read-only." });
    expect(await readFile(configPath, "utf8")).toBe(before);
  });

  test.for<Record<string, string>>([
    { intent: "add_record", type: "A", name: "new.tailnet.test", value: "100.64.0.9" },
    { intent: "remove_record", type: "A", name: "inline.tailnet.test" },
  ])("records kept inline in the config can't be changed ($intent)", async (form) => {
    const { app, cookie, configPath } = await appFor({
      base_domain: "tailnet.test",
      extra_records: [{ name: "inline.tailnet.test", type: "A", value: "100.64.0.8" }],
    });
    await using _ = app;
    const before = await readFile(configPath, "utf8");

    const result = await app.call(dnsAction, "/dns", { as: cookie, form });

    expect(statusOf(result)).toBe(403);
    expect(errorsOf(result)).toEqual({
      form: "DNS records can only be changed through dns.extra_records_path.",
    });
    expect(await readFile(configPath, "utf8")).toBe(before);
  });

  test("there's no DNS page without Headscale's config", async () => {
    await using app = await createTestApp({
      headscale: { url: "http://127.0.0.1:1", apiKey: "unused" },
    });

    const { cookie } = await app.signIn("owner");
    expect(statusOf(await app.call(loader, "/dns", { as: cookie }))).toBe(404);
  });
});
