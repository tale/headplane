import { chmod, readFile } from "node:fs/promises";

import tc from "testcontainers";
import { Agent, request } from "undici";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { restrictionAction } from "~/routes/settings/restrictions/actions";

import { HARNESS_LABEL } from "../../harness/headscale";
import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { DEX_IMAGE, testedVersions } from "../../harness/versions";
import { waitFor } from "../../harness/wait";
import { statusOf, type TestApp } from "../../support/app";

// bcrypt of "password"
const PASSWORD_HASH = "$2a$10$2b2cU8CPhOTaGrs1HRQuAueS7JTT5ZHsHSzYiFPm1leZck7Mc8T4W";

const DEX_CONFIG = `
issuer: http://dex:5556
storage: { type: memory }
web: { http: 0.0.0.0:5556 }
oauth2: { skipApprovalScreen: true }
enablePasswordDB: true
staticClients:
  - id: headscale
    secret: headscale-secret
    name: Headscale
    redirectURIs: ["https://headscale/oidc/callback"]
staticPasswords:
  - { email: alice@allowed.test, username: alice, userID: "1", hash: "${PASSWORD_HASH}" }
  - { email: mallory@other.test, username: mallory, userID: "2", hash: "${PASSWORD_HASH}" }
`;

describe.for(testedVersions())("sign-in restrictions on Headscale %s", (version) => {
  let tailnet: Tailnet;
  let dex: tc.StartedTestContainer;
  let app: TestApp;
  let owner: string;
  let agent: Agent;

  beforeAll(async () => {
    tailnet = await createTailnet({
      version,
      headscaleConfig: {
        oidc: {
          issuer: "http://dex:5556",
          client_id: "headscale",
          client_secret: "headscale-secret",
          // Dex joins the tailnet's network after Headscale starts.
          only_start_if_oidc_is_available: false,
        },
      },
    });

    dex = await new tc.GenericContainer(DEX_IMAGE)
      .withNetwork(tailnet.network)
      .withNetworkAliases("dex")
      .withExposedPorts(5556)
      .withCopyContentToContainer([{ content: DEX_CONFIG, target: "/etc/dex/harness.yaml" }])
      .withCommand(["dex", "serve", "/etc/dex/harness.yaml"])
      .withWaitStrategy(tc.Wait.forLogMessage("listening on", 1).withStartupTimeout(30_000))
      .start();

    await tailnet.server.container.restart();
    await waitFor("Headscale to restart", () => tailnet.api.users.list());

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
    agent = new Agent({ connect: { ca: tailnet.server.caCert } });
  });

  afterAll(async () => {
    await agent?.close();
    await dex?.stop({ remove: true, removeVolumes: true });
    await tailnet?.dispose();
  });

  function restriction(form: Record<string, string>) {
    return app.call(restrictionAction, "/settings/restrictions", { as: owner, form });
  }

  // Walks a browser through Headscale's OIDC login on Dex, submitting each
  // form it lands on: Dex's login, then 0.29's registration confirmation.
  async function signInAt(registerUrl: string, email: string) {
    const hosts = {
      "https://headscale": tailnet.server.url,
      "http://dex:5556": `http://${dex.getHost()}:${dex.getMappedPort(5556)}`,
    };

    const local = (url: string) =>
      Object.entries(hosts).reduce((out, [from, to]) => out.replace(from, to), url);

    const cookies = new Map<string, string>();
    let url = local(registerUrl);
    let form: string | undefined;

    for (let hop = 0; hop < 20; hop++) {
      const { origin } = new URL(url);
      const response = await request(url, {
        method: form ? "POST" : "GET",
        body: form,
        dispatcher: agent,
        headers: {
          cookie: cookies.get(origin) ?? "",
          ...(form && { "content-type": "application/x-www-form-urlencoded" }),
        },
      });

      const setCookie = [response.headers["set-cookie"] ?? []].flat();
      const jar = [cookies.get(origin), ...setCookie.map((cookie) => cookie.split(";")[0])];
      cookies.set(origin, jar.filter(Boolean).join("; "));

      const location = response.headers.location;
      if (typeof location === "string") {
        await response.body.dump();
        url = local(new URL(location, url).href);
        form = undefined;
        continue;
      }

      const body = await response.body.text();
      const action = body.match(/<form[^>]*action="([^"]*)"/)?.[1];
      if (action === undefined) {
        return { status: response.statusCode, body };
      }

      const fields = new URLSearchParams();
      for (const [input] of body.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
        const name = input.match(/name="([^"]+)"/)?.[1];
        if (name) fields.set(name, input.match(/value="([^"]*)"/)?.[1] ?? "");
      }

      if (body.includes('name="password"')) {
        fields.set("login", email);
        fields.set("password", "password");
      }

      url = local(new URL(action.replaceAll("&amp;", "&"), url).href);
      form = fields.toString();
    }

    throw new Error(`Too many redirects signing in as ${email}`);
  }

  async function expectRefused(name: string, email: string) {
    const pending = await tailnet.pendingNode({ name });
    const result = await signInAt(pending.registerUrl, email);

    expect(result.status).toBe(401);
    expect((await tailnet.api.nodes.list()).map((node) => node.name)).not.toContain(name);
    await pending.stop();
  }

  async function expectAdmitted(name: string, email: string) {
    const pending = await tailnet.pendingNode({ name });
    const result = await signInAt(pending.registerUrl, email);

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
