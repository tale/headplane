import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";

import { loader } from "~/routes/ssh/page";

import { startBrowser } from "../../harness/browser-ssh";
import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { testedVersions } from "../../harness/versions";
import { waitFor } from "../../harness/wait";
import { statusOf, type TestApp } from "../../support/app";
import { tempDir } from "../../support/temp";

const POLICY = {
  tagOwners: { "tag:vault": ["alice@"] },
  acls: [{ action: "accept", src: ["*"], dst: ["*:*"] }],
  ssh: [
    { action: "accept", src: ["autogroup:member"], dst: ["autogroup:self"], users: ["root"] },
    { action: "check", src: ["autogroup:member"], dst: ["tag:vault"], users: ["root"] },
  ],
};

// The command echoes back as typed, so only running it prints the answer.
const COMMAND = "echo hp-$((6*7))\nexit\n";

for (const version of testedVersions()) {
  // Browser SSH needs the agent, which needs Headscale 0.28.
  describe.skipIf(version === "0.27.1")(`Browser SSH on Headscale ${version}`, () => {
    let tailnet: Tailnet;
    let app: TestApp;
    let browser: Awaited<ReturnType<typeof startBrowser>>;
    let cookie: string;

    beforeAll(async () => {
      tailnet = await createTailnet({ version, policy: POLICY });
      app = await tailnet.headplane({
        config: {
          headscale: { public_url: tailnet.server.controlUrl },
          integration: {
            agent: {
              enabled: true,
              executable_path: inject("sshAgentPath"),
              work_dir: await tempDir(),
            },
          },
        },
      });

      const alice = await tailnet.user("alice@");
      const signedIn = await app.signIn("owner");
      await app.ctx.auth.linkHeadscaleUser(signedIn.userId, alice.id);
      cookie = signedIn.cookie;

      browser = await startBrowser(
        { id: tailnet.id, network: tailnet.network, caCert: tailnet.server.caCert! },
        inject("sshWasmDir"),
      );
    });

    afterAll(async () => {
      await browser?.stop();
      await tailnet?.dispose();
    });

    // What the page's loader hands the browser for a session.
    async function sessionFor(machine: string, user: string) {
      const result = await app.call(loader, `/ssh/${machine}`, {
        as: cookie,
        params: { id: machine },
        search: `?user=${user}`,
      });

      const { node } = result as { node: NonNullable<Awaited<ReturnType<typeof loader>>["node"]> };
      return {
        controlURL: node.controlURL,
        authKey: node.preAuthKey,
        hostname: node.ephemeralHostname,
        host: node.ipAddress,
        user,
        input: COMMAND,
      };
    }

    test("a session runs commands on the machine", async () => {
      await tailnet.node({ name: "server", user: "alice@", ssh: true });

      const result = await browser.ssh(await sessionFor("server", "root"));
      expect(result.error).toBeUndefined();
      expect(result.output).toContain("hp-42");
    });

    test("joins as a temporary machine of the signed-in person", async () => {
      await tailnet.node({ name: "joined", user: "alice@", ssh: true });
      const session = await sessionFor("joined", "root");
      await browser.ssh(session);

      const machine = (await tailnet.api.nodes.list()).find((n) => n.name === session.hostname);
      expect(machine?.user?.name).toBe("alice@");
      expect(machine?.preAuthKey?.ephemeral).toBe(true);
    });

    test("a user the SSH rules don't allow ends the session with the reason", async () => {
      await tailnet.node({ name: "locked", user: "alice@", ssh: true });

      const result = await browser.ssh({ ...(await sessionFor("locked", "nobody")) });
      expect(result.error).toBeUndefined();
      expect(result.events).toContainEqual(expect.stringMatching(/error SSH Connection Error: /));
    });

    // 0.28 treats check rules as accept.
    test.runIf(version !== "0.28.0")(
      "a check rule shows its sign-in link, then opens once approved",
      async () => {
        await tailnet.node({ name: "vault", tags: ["tag:vault"], ssh: true });
        const session = await sessionFor("vault", "root");
        const done = browser.ssh(session);

        const url = await waitFor("the sign-in link in the terminal", async () => {
          const match = (await browser.output(session.hostname)).match(
            /To authenticate, visit: (\S+)/,
          );
          if (!match) throw new Error("not shown yet");
          return match[1];
        });

        await tailnet.api.auth.approve(url.split("/").pop()!);
        const result = await done;
        expect(result.error).toBeUndefined();
        expect(result.output).toContain("hp-42");
      },
    );

    test.for([
      { name: "a machine that doesn't exist", machine: "missing", status: 404 },
      { name: "a machine that isn't connected", machine: "offline", status: 200 },
    ])("doesn't hand out an auth key for $name", async ({ machine, status }) => {
      if (machine === "offline") {
        const node = await tailnet.node({ name: "offline", user: "alice@", ssh: true });
        await node.down();
      }

      const before = await tailnet.api.preAuthKeys.listAll!();
      const result = await app.call(loader, `/ssh/${machine}`, {
        as: cookie,
        params: { id: machine },
        search: "?user=root",
      });

      expect(statusOf(result)).toBe(status);
      expect(await tailnet.api.preAuthKeys.listAll!()).toHaveLength(before.length);
    });
  });
}
