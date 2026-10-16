import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { data, isRouteErrorResponse, type ShouldRevalidateFunction } from "react-router";

import Button from "~/components/button";
import Callout from "~/components/callout";
import Code from "~/components/code";
import Shell from "~/routes/auth/login/shell";
import {
  agentsContext,
  appConfigContext,
  headscaleContext,
  requestApiContext,
} from "~/server/context";
import { autoLink } from "~/server/web/link";

import type { Route } from "./+types/page";
import { isSSHError, SSHError, sshErrors } from "./errors";
import Ghostty from "./ghostty.client";
import UserPrompt from "./user-prompt";
import { connectTailnet } from "./wasm.client";

const WASM_MODULE_URL = `${__PREFIX__}/hp_ssh.wasm`;
const WASM_HELPER_URL = `${__PREFIX__}/wasm_exec.js`;
const SSH_PREAUTH_KEY_TTL_MS = 10 * 60 * 1000;

export const shouldRevalidate: ShouldRevalidateFunction = () => {
  return false;
};

export async function loader({ request, params, context, url }: Route.LoaderArgs) {
  const agents = context.get(agentsContext);
  const config = context.get(appConfigContext);
  const headscale = context.get(headscaleContext);
  const getRequestApi = context.get(requestApiContext);
  const compatibilityWarning = getBrowserSSHCompatibilityWarning(headscale.version);

  const origin = url.origin;
  const assets = [WASM_HELPER_URL, WASM_MODULE_URL];
  const missing: string[] = [];

  for (const file of assets) {
    const res = await fetch(`${origin}${file}`, { method: "HEAD" });
    if (!res.ok) {
      missing.push(file);
    }
  }

  if (missing.length > 0) {
    throw data(sshErrors.wasm_missing, 405);
  }

  if (agents.state !== "enabled") {
    throw data(sshErrors.agent_required, 400);
  }

  const { principal, api } = await getRequestApi(request);
  if (principal.kind === "api_key") {
    throw data(sshErrors.oidc_required, 403);
  }

  const hostname = params.id;
  const username = url.searchParams.get("user") || undefined;

  const nodes = await api.nodes.list();
  const node = nodes.find((n) => n.givenName === hostname);
  if (!node) {
    throw data(sshErrors.node_not_found(hostname), 404);
  }

  if (!node.online) {
    return { hostname, username, offline: true, node: undefined, compatibilityWarning };
  }

  if (!username) {
    return {
      hostname,
      username: undefined,
      offline: false,
      node: undefined,
      compatibilityWarning,
    };
  }

  // The user must exist within Headscale to generate a pre-auth key
  const users = await api.users.list();
  const headscaleUserId =
    principal.user.headscaleUserId ?? (await autoLink({ request, context }, principal));
  const hsUser = users.find((u) => u.id === headscaleUserId);

  if (!hsUser) {
    throw data(sshErrors.user_not_linked, 404);
  }

  const preAuthKey = await api.preAuthKeys.create({
    user: hsUser.id,
    ephemeral: true,
    reusable: false,
    expiration: new Date(Date.now() + SSH_PREAUTH_KEY_TTL_MS),
    aclTags: null,
  });

  const controlURL = config.headscale.public_url ?? config.headscale.url;
  return {
    hostname,
    username,
    offline: false,
    node: {
      ipAddress: node.ipAddresses[0],
      controlURL,
      preAuthKey: preAuthKey.key,
      ephemeralHostname: generateHostname(username),
    },
    compatibilityWarning,
  };
}

function getBrowserSSHCompatibilityWarning(version: {
  unknown: boolean;
  major: number;
  minor: number;
  patch: number;
  raw: string;
}) {
  if (version.unknown) return null;
  if (version.major === 0 && version.minor === 29 && version.patch < 2) {
    return { version: version.raw };
  }
  return null;
}

function generateHostname(username: string) {
  const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `ssh-${hex}-${username}`;
}

export const links: Route.LinksFunction = () => [
  {
    rel: "preload",
    href: WASM_MODULE_URL,
    as: "fetch",
    type: "application/wasm",
    crossOrigin: "anonymous",
  },
];

export default function Page({ loaderData }: Route.ComponentProps) {
  const { hostname, username, offline, node, compatibilityWarning } = loaderData;

  if (offline) {
    return (
      <>
        <BrowserSSHCompatibilityBanner warning={compatibilityWarning} />
        <Shell
          description="It isn't connected to the tailnet right now. Start Tailscale on it, then try again."
          title={`${hostname} is offline`}
        >
          <Button onClick={() => window.location.reload()} variant="primary">
            Try again
          </Button>
        </Shell>
      </>
    );
  }

  if (!username || !node) {
    return (
      <>
        <BrowserSSHCompatibilityBanner warning={compatibilityWarning} />
        <UserPrompt hostname={hostname} />
      </>
    );
  }

  return (
    <>
      <BrowserSSHCompatibilityBanner warning={compatibilityWarning} />
      <SSHConsole hostname={hostname} username={username} node={node} />
    </>
  );
}

function BrowserSSHCompatibilityBanner({
  warning,
}: {
  warning: { version: string } | null | undefined;
}) {
  if (!warning) return null;

  return (
    <div className="fixed inset-x-4 top-4 z-[60] mx-auto max-w-2xl">
      <Callout
        className="bg-raised"
        isDismissable
        variant="warning"
        title={`Browser SSH is broken on Headscale ${warning.version}`}
      >
        Headscale 0.29 beta releases through 0.29.1 reject Tailscale's browser/WASM{" "}
        <Code>/ts2021</Code> WebSocket request with <Code>405 Method Not Allowed</Code>. Upgrade
        Headscale to 0.29.2 or newer, or use Headscale 0.28.x.
      </Callout>
    </div>
  );
}

function SSHConsole({
  hostname,
  username,
  node,
}: {
  hostname: string;
  username: string;
  node: { ipAddress: string; controlURL: string; preAuthKey: string; ephemeralHostname: string };
}) {
  const [ipn, setIpn] = useState<IPN | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Joining Tailnet…");

  useEffect(() => {
    let cancelled = false;

    connectTailnet({
      controlURL: node.controlURL,
      authKey: node.preAuthKey,
      hostname: node.ephemeralHostname,
      onPanic: (error) => {
        if (!cancelled) setStatus(`Tailnet node stopped: ${error}`);
      },
    }).then(
      (instance) => {
        if (cancelled) return;
        setStatus(`Connecting to ${hostname}…`);
        setIpn(instance);
      },
      (error: unknown) => {
        if (cancelled) return;
        setStatus(`Failed to join Tailnet: ${error instanceof Error ? error.message : error}`);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [node, hostname]);

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {!connected && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="text-faint size-8 animate-spin" />
            <p className="text-muted text-sm">{status}</p>
          </div>
        </div>
      )}

      {ipn && (
        <Ghostty
          ipn={ipn}
          username={username}
          ipAddress={node.ipAddress}
          onConnected={() => setConnected(true)}
        />
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const routeError = isRouteErrorResponse(error) ? error.data : null;
  if (routeError == null || !isSSHError(routeError)) {
    // Pass through further down the tree to the global error boundary
    throw error;
  }

  return (
    <SSHError anchor={routeError.anchor} message={routeError.message} title={routeError.title} />
  );
}
