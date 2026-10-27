import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer, type AddressInfo, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "node:tls";

import {
  chromium,
  type Browser,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from "playwright";
import tc from "testcontainers";
import { stringify } from "yaml";

import { PASSWORD_HASH } from "./dex";
import { startHeadplane, writeHeadplaneConfig } from "./headplane";
import { freePort } from "./headscale";
import { applyScenario } from "./scenario";
import homelab from "./scenarios/homelab";
import { createTailnet, type Tailnet } from "./tailnet";
import { DEX_IMAGE, type HeadscaleVersion } from "./versions";
import { waitFor } from "./wait";

type Machine = Awaited<ReturnType<typeof applyScenario>>[string];

const FASTFETCH_CONFIG = {
  display: { key: { type: "both" } },
  modules: [
    "title",
    "separator",
    "os",
    "uptime",
    "packages",
    "shell",
    "cpu",
    "memory",
    "disk",
    "break",
    "colors",
  ],
};
// The user, binary name and arguments of each service loadgen stands in for.
const SERVICES = [
  ["grafana", "grafana-server", "--homepath=/usr/share/grafana --config=/etc/grafana/grafana.ini"],
  [
    "prometheus",
    "prometheus",
    "--config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/var/lib/prometheus",
  ],
  ["loki", "loki", "-config.file=/etc/loki/loki-local-config.yaml"],
  ["prometheus", "node_exporter", "--web.listen-address=:9100"],
];

const DAY = 24 * 60 * 60_000;
const ASSETS_DIR = join(import.meta.dirname, "../../docs/assets");

type Rect = { x: number; y: number; width: number; height: number };

// Serves Headscale over plain HTTP to Headplane and the agent, since the agent
// doesn't trust the harness's certificate.
async function startPlainBridge(target: URL, ca: string) {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    const upstream = connect({ host: target.hostname, port: Number(target.port), ca });
    sockets.add(socket).add(upstream);
    socket.pipe(upstream).pipe(socket);
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close() {
      for (const socket of sockets) socket.destroy();
      server.close();
    },
  };
}

// Machine keys are new every run. The agent matches on the real ones, so they
// are swapped on the page instead, for keys derived from the machine's name.
async function keyReplacements(tailnet: Tailnet) {
  const replacements: Record<string, string> = {};
  for (const node of await tailnet.api.nodes.list()) {
    for (const field of ["nodeKey", "machineKey", "discoKey"] as const) {
      const [prefix] = node[field].split(":");
      const hash = createHash("sha256").update(`${field}:${node.name}`).digest("hex");
      replacements[node[field]] = `${prefix}:${hash}`;
    }
  }

  return replacements;
}

// The box from the top of `from` to the bottom of `to`, with some room around it.
async function around(from: Locator, to: Locator = from, padding = 48): Promise<Rect> {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  const x = Math.min(a.x, b.x) - padding;
  const y = Math.min(a.y, b.y) - padding;
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) + padding - x,
    height: Math.max(a.y + a.height, b.y + b.height) + padding - y,
  };
}

// The form side of the sign-in layout, without the animated grid beside it.
function shellCard(page: Page) {
  return () => around(page.locator("main > div").first());
}

function dialog(page: Page) {
  return () => around(page.getByRole("dialog"), undefined, 64);
}

const CONTEXT_OPTIONS: BrowserContextOptions = {
  viewport: { width: 1120, height: 760 },
  deviceScaleFactor: 2,
  locale: "en-US",
  timezoneId: "UTC",
  // Headscale's certificate is the harness's own.
  ignoreHTTPSErrors: true,
};

async function newPage(browser: Browser) {
  return (await browser.newContext(CONTEXT_OPTIONS)).newPage();
}

async function settle(page: Page, replacements: Record<string, string>) {
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  await page.evaluate((replacements) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const [from, to] of Object.entries(replacements)) {
        if (node.textContent!.includes(from))
          node.textContent = node.textContent!.split(from).join(to);
      }
    }
  }, replacements);
}

// Saves light and dark screenshots of the page. Pages without a light theme,
// like the terminal, are saved once.
async function shoot(
  page: Page,
  replace: () => Promise<Record<string, string>>,
  name: string,
  { clip, isThemed = true }: { clip?: () => Promise<Rect>; isThemed?: boolean } = {},
) {
  const replacements = await replace();
  for (const colorScheme of isThemed ? (["light", "dark"] as const) : (["dark"] as const)) {
    await page.emulateMedia({ colorScheme });
    await settle(page, replacements);

    const path = join(ASSETS_DIR, isThemed ? `${name}-${colorScheme}.png` : `${name}.png`);
    await page.screenshot({ path, clip: await clip?.(), animations: "disabled", caret: "hide" });
    console.log(`Saved ${path}`);
  }
}

// Builds hp_agent and returns a launcher that runs it through agent-hostinfo.ts.
// The agent gets no PATH, so the launcher uses absolute paths.
async function buildAgent() {
  const dir = await mkdtemp(join(tmpdir(), "hp-screenshots-"));
  const agentPath = join(dir, "hp_agent");
  execFileSync("go", ["build", "-o", agentPath, "./cmd/hp_agent"], { stdio: "inherit" });

  const overrides = Object.fromEntries([
    ...homelab.nodes.map((node) => [node.name, node.hostInfo]),
    ["headplane-agent", { OS: "linux", OSVersion: "6.8.0-85-generic" }],
  ]);

  const overridesPath = join(dir, "hostinfo.json");
  await writeFile(overridesPath, JSON.stringify(overrides));

  const wrapper = join(import.meta.dirname, "agent-hostinfo.ts");
  const launcherPath = join(dir, "launch-agent");
  const command = [process.execPath, "--no-warnings", wrapper, agentPath, overridesPath];
  await writeFile(launcherPath, `#!/bin/sh\nexec ${command.map((arg) => `"${arg}"`).join(" ")}\n`, {
    mode: 0o755,
  });

  return launcherPath;
}

// Dex with the scenario's people, all with the password "password". Its port
// is the same on the host, so Headplane and the browser share one issuer URL.
async function startDex(headplanePort: number) {
  const port = await freePort();
  const issuer = `http://localhost:${port}`;
  const config = stringify({
    issuer,
    storage: { type: "memory" },
    web: { http: `0.0.0.0:${port}` },
    oauth2: { skipApprovalScreen: true },
    enablePasswordDB: true,
    staticClients: [
      {
        id: "headplane",
        secret: "headplane-secret",
        name: "Headplane",
        redirectURIs: [`http://localhost:${headplanePort}/admin/oidc/callback`],
      },
    ],
    staticPasswords: homelab.users.map((user, index) => ({
      email: ssoEmail(user),
      username: user.displayName,
      userID: String(index + 1),
      hash: PASSWORD_HASH,
    })),
  });

  const container = await new tc.GenericContainer(DEX_IMAGE)
    .withExposedPorts({ container: port, host: port })
    .withCopyContentToContainer([{ content: config, target: "/etc/dex/screenshots.yaml" }])
    .withCommand(["dex", "serve", "/etc/dex/screenshots.yaml"])
    .withWaitStrategy(tc.Wait.forLogMessage("listening on", 1).withStartupTimeout(30_000))
    .start();

  return {
    issuer,
    async [Symbol.asyncDispose]() {
      await container.stop();
    },
  };
}

// Alice's Headscale user was created from the CLI without an email, so only
// the identity provider knows it.
function ssoEmail(user: (typeof homelab.users)[number]) {
  return user.email ?? `${user.name}@example.com`;
}

async function signInWithSso(page: Page, base: string, email: string) {
  // What "Continue with SSO" links to, without waiting for it to hydrate.
  await page.goto(`${base}/oidc/start`);
  await page.locator('input[name="login"]').fill(email);
  await page.locator('input[name="password"]').fill("password");
  await page.locator('button[type="submit"]').click();
  // Members without dashboard access land on the home page instead.
  await page.waitForURL(`${base}/**`);
}

// Sets up what the Browser SSH shots run, as a regular user with fastfetch's
// Nerd Font key icons, and a stand-in monitoring stack for btop to show.
async function prepareSshMachine(machine: Machine) {
  const arch = (await machine.exec(["uname", "-m"])).trim() === "x86_64" ? "amd64" : "arm64";
  const loadgenPath = join(await mkdtemp(join(tmpdir(), "hp-screenshots-")), "loadgen");
  execFileSync("go", ["build", "-o", loadgenPath, "./tests/harness/loadgen.go"], {
    stdio: "inherit",
    env: { ...process.env, GOOS: "linux", GOARCH: arch, CGO_ENABLED: "0" },
  });

  await machine.copyFiles([{ source: loadgenPath, target: "/tmp/loadgen", mode: 0o755 }]);
  const services = SERVICES.flatMap(([user, name, args]) => [
    `adduser -S -D -H ${user} 2> /dev/null || true`,
    `cp /tmp/loadgen /usr/sbin/${name}`,
    // Detached, since tailscaled runs as PID 1 and never reaps orphans.
    `setsid su -s /bin/sh ${user} -c 'exec /usr/sbin/${name} ${args}' > /dev/null 2>&1 &`,
  ]);

  await machine.exec([
    "sh",
    "-c",
    [
      "set -e",
      "apk add --no-cache btop fastfetch",
      "adduser -D alice",
      ": > /etc/motd",
      "mkdir -p /home/alice/.config/fastfetch /home/alice/.config/btop",
      `echo '${JSON.stringify(FASTFETCH_CONFIG)}' > /home/alice/.config/fastfetch/config.jsonc`,
      "echo 'update_ms = 100' > /home/alice/.config/btop/btop.conf",
      "chown -R alice:alice /home/alice/.config",
      ...services,
    ].join("\n"),
  ]);
}

// Seeds the homelab scenario and retakes the docs screenshots in docs/assets.
export async function takeScreenshots(version: HeadscaleVersion, port: number) {
  const agentPath = await buildAgent();
  // A production build, since development's StrictMode starts Browser SSH twice
  // with its single-use key. The version otherwise comes from `git describe`
  // and changes every commit.
  const { version: headplaneVersion } = JSON.parse(await readFile("package.json", "utf8"));
  execFileSync("./build.sh", ["--wasm"], { stdio: "inherit" });
  execFileSync("pnpm", ["build"], {
    stdio: "inherit",
    // The harness runs under Vite, which sets NODE_ENV for its own mode.
    env: { ...process.env, NODE_ENV: "production", HEADPLANE_VERSION: headplaneVersion },
  });

  await using dex = await startDex(port);
  await using tailnet = await createTailnet({
    version,
    records: homelab.records,
    headscaleConfig: {
      ...homelab.headscaleConfig,
      // For the sign-in restrictions page. Headscale can't reach Dex on the
      // host's localhost, so it starts without it.
      oidc: {
        only_start_if_oidc_is_available: false,
        issuer: dex.issuer,
        client_id: "headscale",
        client_secret: "headscale-secret",
        allowed_domains: ["example.com"],
      },
    },
  });

  const machines = await applyScenario(tailnet, homelab, { serial: true });
  await prepareSshMachine(machines.grafana);

  // The keys the nodes joined with are spent, so the auth keys page gets a few
  // that are still active.
  const [alice] = await tailnet.api.users.list({ name: "alice" });
  const [bob] = await tailnet.api.users.list({ name: "bob" });
  for (const key of [
    { user: alice.id, reusable: true, ephemeral: false, days: 30, aclTags: null },
    { user: bob.id, reusable: false, ephemeral: false, days: 7, aclTags: null },
    { user: null, reusable: true, ephemeral: true, days: 90, aclTags: ["tag:server"] },
  ]) {
    const { days, ...options } = key;
    await tailnet.api.preAuthKeys.create({
      ...options,
      expiration: new Date(Date.now() + days * DAY),
    });
  }
  const nodes = await tailnet.api.nodes.list();
  const nodeId = (name: string) => nodes.find((node) => node.name === name)!.id;

  const bridge = await startPlainBridge(new URL(tailnet.server.url), tailnet.server.caCert!);
  const configPath = await writeHeadplaneConfig(tailnet, {
    port,
    // Chrome keeps secure cookies on http://localhost, and the login page
    // still shows its insecure connection warning.
    server: { cookie_secure: true, base_url: `http://localhost:${port}` },
    headscale: {
      url: bridge.url,
      // The browser resolves it to Headscale, for Browser SSH.
      public_url: "https://headscale.example.com",
      tls_cert_path: undefined,
    },
    oidc: {
      issuer: dex.issuer,
      client_id: "headplane",
      client_secret: "headplane-secret",
    },
    integration: {
      agent: {
        enabled: true,
        executable_path: agentPath,
        work_dir: await mkdtemp(join(tmpdir(), "hp-screenshots-agent-")),
      },
    },
  });

  const headplane = startHeadplane(configPath, port, {
    isProduction: true,
    env: {
      NODE_ENV: "production",
      TZ: "UTC",
      LANG: "en_US.UTF-8",
    },
  });

  // Browser SSH reaches Headscale by its public URL, and its DERP server by
  // the name the tailnet uses. Headscale sends no CORS headers, which a reverse
  // proxy would add.
  const headscale = `127.0.0.1:${new URL(tailnet.server.url).port}`;
  const controlHost = new URL(tailnet.server.controlUrl).hostname;
  const browser = await chromium.launch({
    args: [
      `--host-resolver-rules=MAP headscale.example.com ${headscale}, MAP ${controlHost} ${headscale}`,
      "--disable-web-security",
    ],
  });
  const base = `http://localhost:${port}/admin`;
  const replace = () => keyReplacements(tailnet);
  try {
    await waitFor(
      "Headplane",
      async () => {
        const response = await fetch(`${base}/healthz`);
        if (!response.ok) throw new Error(`status ${response.status}`);
      },
      { timeout: 120_000, interval: 500 },
    );

    const page = await newPage(browser);

    // Cropped to the form, since the animated grid beside it is random.
    await page.goto(`${base}/login`);
    const heading = page.getByRole("heading", { name: "Sign in to Headplane" });
    const signIn = page.getByRole("button", { name: "Sign in" });
    await shoot(page, replace, "login-banner", { clip: () => around(heading, signIn) });

    // Alice signs in first and becomes the owner. With no email on her
    // Headscale user, Headplane asks which one is hers.
    await signInWithSso(page, base, ssoEmail(homelab.users[0]));
    await page.getByRole("heading", { name: "Link your account" }).waitFor();
    await shoot(page, replace, "link", { clip: shellCard(page) });
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: homelab.users[0].name, exact: true }).click();
    await page.getByRole("button", { name: "Link account" }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/link"));

    // Bob and Carol join as members, linked to their Headscale users by email,
    // and land on the page for people without dashboard access.
    for (const user of homelab.users.slice(1)) {
      const other = await newPage(browser);
      await signInWithSso(other, base, ssoEmail(user));
      if (user.name === "bob") {
        await other.getByRole("heading", { name: "Connect your devices" }).waitFor();
        await shoot(other, replace, "home", { clip: shellCard(other) });
      }

      await other.context().close();
    }

    // The agent reports every machine at once, and shows as connected a little
    // after joining.
    await waitFor(
      "the agent's machine details",
      async () => {
        await page.goto(`${base}/machines`);
        await page.getByText("Windows").waitFor({ timeout: 1000 });
        const agentRow = page.getByRole("row").filter({ hasText: "headplane-agent" });
        await agentRow.getByText("Connected").waitFor({ timeout: 1000 });
      },
      { timeout: 180_000, interval: 2000 },
    );

    for (const [name, path] of [
      ["preview", "/machines"],
      ["machine", `/machines/${nodeId("nas")}`],
      ["dns", "/dns"],
      ["users", "/users"],
      ["acls", "/acls"],
      ["agent", "/settings/agent"],
      ["auth-keys", "/settings/auth-keys"],
      ["restrictions", "/settings/restrictions"],
    ]) {
      await page.goto(`${base}${path}`);
      await shoot(page, replace, name);
    }

    await page.goto(`${base}/settings/auth-keys`);
    await page.getByRole("button", { name: "Create key" }).click();
    await page.getByRole("dialog").waitFor();
    await shoot(page, replace, "auth-key-dialog", { clip: dialog(page) });

    await page.goto(`${base}/machines`);
    await page.getByRole("button", { name: "Add machine" }).click();
    await page.getByRole("menu").waitFor();
    await shoot(page, replace, "add-machine");

    await page.goto(`${base}/machines/${nodeId("bob-pi")}`);
    await page.getByRole("button", { name: "Edit routes" }).click();
    await page.getByRole("dialog").waitFor();
    await shoot(page, replace, "routes", { clip: dialog(page) });

    await page.goto(`${base}/users`);
    const bobRow = page.getByRole("row").filter({ hasText: homelab.users[1].displayName });
    await bobRow.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Change role" }).click();
    await page.getByRole("dialog").waitFor();
    await shoot(page, replace, "users-role", { clip: dialog(page) });

    await page.goto(`${base}/ssh/grafana`);
    await shoot(page, replace, "ssh-prompt", { clip: shellCard(page) });

    // Last, since the session joins the tailnet as a temporary machine. The
    // terminal is a canvas, so these wait for output to draw rather than for
    // text. They change every run.
    await page.goto(`${base}/ssh/grafana?user=alice`);
    await page
      .getByText(/Joining Tailnet|Connecting to/)
      .waitFor({ state: "hidden", timeout: 120_000 });
    await page.keyboard.type("fastfetch\n");
    await page.waitForTimeout(2000);
    await shoot(page, replace, "ssh-fastfetch", { isThemed: false });

    // btop fills in its graphs over a few refreshes.
    await page.keyboard.type("clear && btop\n");
    await page.waitForTimeout(20_000);
    await shoot(page, replace, "ssh-btop", { isThemed: false });
  } catch (error) {
    const pages = browser.contexts().flatMap((context) => context.pages());
    for (const [index, open] of pages.entries()) {
      const failure = join(tmpdir(), `hp-screenshots-failure-${index}.png`);
      await open.screenshot({ path: failure });
      console.error(`A page when it failed: ${failure} (${open.url()})`);
    }

    throw error;
  } finally {
    await browser.close();
    headplane.kill("SIGTERM");
    bridge.close();
  }
}
