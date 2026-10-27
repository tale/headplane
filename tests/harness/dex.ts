import tc from "testcontainers";
import { Agent, request } from "undici";

import type { Tailnet } from "./tailnet";
import { DEX_IMAGE } from "./versions";
import { waitFor } from "./wait";

export async function startDex() {
  const container = await new tc.GenericContainer(DEX_IMAGE)
    .withExposedPorts(5556)
    .withEnvironment({
      DEX_ISSUER: "http://0.0.0.0:5556",
      DEX_ENABLE_PASSWORD_DB: "true",
      DEX_OAUTH2_SKIP_APPROVAL_SCREEN: "true",
    })
    .withWaitStrategy(tc.Wait.forLogMessage("listening on", 1).withStartupTimeout(30_000))
    .start();

  // Reachable from the host, unlike the issuer Dex advertises.
  const issuerUrl = `http://${container.getHost()}:${container.getMappedPort(5556)}`;
  return { container, issuerUrl };
}

const ISSUER = "http://dex:5556";
export const HEADPLANE_URL = "http://headplane.test";

// bcrypt of "password"
export const PASSWORD_HASH = "$2a$10$2b2cU8CPhOTaGrs1HRQuAueS7JTT5ZHsHSzYiFPm1leZck7Mc8T4W";

const CONFIG = `
issuer: ${ISSUER}
storage: { type: memory }
web: { http: 0.0.0.0:5556 }
oauth2: { skipApprovalScreen: true }
enablePasswordDB: true
staticClients:
  - id: headscale
    secret: headscale-secret
    name: Headscale
    redirectURIs: ["https://headscale/oidc/callback"]
  - id: headplane
    secret: headplane-secret
    name: Headplane
    redirectURIs: ["${HEADPLANE_URL}${__PREFIX__}/oidc/callback"]
staticPasswords:
  - { email: alice@allowed.test, username: alice, userID: "1", hash: "${PASSWORD_HASH}" }
  - { email: mallory@other.test, username: mallory, userID: "2", hash: "${PASSWORD_HASH}" }
`;

// For createTailnet's headscaleConfig, followed by startTailnetDex.
export const HEADSCALE_OIDC = {
  oidc: {
    issuer: ISSUER,
    client_id: "headscale",
    client_secret: "headscale-secret",
    // Dex joins the tailnet's network after Headscale starts.
    only_start_if_oidc_is_available: false,
  },
};

// Dex on the tailnet's network with clients for Headscale and Headplane, and
// alice@allowed.test and mallory@other.test, both with the password "password".
export async function startTailnetDex(tailnet: Tailnet) {
  const container = await new tc.GenericContainer(DEX_IMAGE)
    .withNetwork(tailnet.network)
    .withNetworkAliases("dex")
    .withExposedPorts(5556)
    .withCopyContentToContainer([{ content: CONFIG, target: "/etc/dex/harness.yaml" }])
    .withCommand(["dex", "serve", "/etc/dex/harness.yaml"])
    .withWaitStrategy(tc.Wait.forLogMessage("listening on", 1).withStartupTimeout(30_000))
    .start();

  await tailnet.server.container.restart();
  await waitFor("Headscale to restart", () => tailnet.api.users.list());

  const url = `http://${container.getHost()}:${container.getMappedPort(5556)}`;
  const hosts = { "https://headscale": tailnet.server.url, [ISSUER]: url };
  const local = (target: string) =>
    Object.entries(hosts).reduce((out, [from, to]) => out.replace(from, to), target);
  const agent = new Agent({ connect: { ca: tailnet.server.caCert } });

  // Walks a browser through Headscale and Dex as `email`, submitting each form
  // it lands on: Dex's login, then 0.29's registration confirmation. Stops at
  // a page without a form, or at a redirect back to Headplane.
  async function signIn(start: string, email: string) {
    const cookies = new Map<string, string>();
    let target = local(start);
    let form: string | undefined;

    for (let hop = 0; hop < 20; hop++) {
      const { origin } = new URL(target);
      const response = await request(target, {
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
        const next = new URL(location, target);
        if (next.origin === HEADPLANE_URL) {
          return { status: response.statusCode, body: "", location: next.href };
        }

        target = local(next.href);
        form = undefined;
        continue;
      }

      const body = await response.body.text();
      const action = body.match(/<form[^>]*action="([^"]*)"/)?.[1];
      if (action === undefined) {
        return { status: response.statusCode, body, location: undefined };
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

      target = local(new URL(action.replaceAll("&amp;", "&"), target).href);
      form = fields.toString();
    }

    throw new Error(`Too many redirects signing in as ${email}`);
  }

  // Headplane reaches Dex from the host but keeps Headscale's issuer, so both
  // see the same subjects. Needs server.base_url set to HEADPLANE_URL.
  const headplaneOidc = {
    issuer: ISSUER,
    client_id: "headplane",
    client_secret: "headplane-secret",
    authorization_endpoint: `${ISSUER}/auth`,
    token_endpoint: `${url}/token`,
    userinfo_endpoint: `${url}/userinfo`,
    jwks_endpoint: `${url}/keys`,
  };

  return {
    container,
    signIn,
    headplaneOidc,
    async stop() {
      await agent.close();
      await container.stop({ remove: true, removeVolumes: true });
    },
  };
}
