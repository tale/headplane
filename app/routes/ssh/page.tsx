import { Loader2, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { data, isRouteErrorResponse, type ShouldRevalidateFunction } from "react-router";
import { ExternalScriptsHandle } from "remix-utils/external-scripts";

import Button from "~/components/button";
import Card from "~/components/card";
import Code from "~/components/code";
import { findHeadscaleUserBySubject } from "~/server/web/headscale-identity";

import type { Route } from "./+types/page";
import { isSSHError, SSHErrorBoundary, sshErrors } from "./errors";
import Ghostty from "./ghostty.client";
import UserPrompt from "./user-prompt";
import type { HeadplaneSSH } from "./wasm.client";
import { loadHeadplaneWASM } from "./wasm.client";

const WASM_MODULE_URL = `${__PREFIX__}/hp_ssh.wasm`;
const WASM_HELPER_URL = `${__PREFIX__}/wasm_exec.js`;

export const shouldRevalidate: ShouldRevalidateFunction = () => {
  return false;
};

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
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

  if (context.agents == null) {
    throw data(sshErrors.agent_required, 400);
  }

  const principal = await context.auth.require(request);
  if (principal.kind === "api_key") {
    throw data(sshErrors.oidc_required, 403);
  }

  const apiKey = context.auth.getHeadscaleApiKey(principal);
  const api = context.hsApi.getRuntimeClient(apiKey);

  const hostname = params.id;
  const username = new URL(request.url).searchParams.get("user") || undefined;

  const nodes = await api.getNodes();
  const node = nodes.find((n) => n.givenName === hostname);
  if (!node) {
    throw data(sshErrors.node_not_found(hostname), 404);
  }

  if (!node.online) {
    return { hostname, username, offline: true, node: undefined };
  }

  if (!username) {
    return { hostname, username: undefined, offline: false, node: undefined };
  }

  // The user must exist within Headscale to generate a pre-auth key
  const users = await api.getUsers();
  const hsUser = findHeadscaleUserBySubject(users, principal.user.subject, principal.profile.email);

  if (!hsUser) {
    throw data(sshErrors.user_not_linked, 404);
  }

  const preAuthKey = await api.createPreAuthKey(
    hsUser.id,
    true,
    false,
    new Date(Date.now() + 60 * 1000), // 1 minute expiry
    null,
  );

  const controlURL = context.config.headscale.public_url ?? context.config.headscale.url;
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
  };
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

export const handle: ExternalScriptsHandle = {
  scripts: [
    {
      src: WASM_HELPER_URL,
      crossOrigin: "anonymous",
      preload: true,
    },
  ],
};

export default function Page({ loaderData }: Route.ComponentProps) {
  const { hostname, username, offline, node } = loaderData;

  if (offline) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <Card className="w-screen" variant="flat">
          <div className="flex items-center justify-between gap-4">
            <Card.Title>Node Offline</Card.Title>
            <WifiOff className="mb-2 h-6 w-6 text-red-500" />
          </div>
          <Card.Text>
            <Code>{hostname}</Code> is not currently connected to the Tailnet.
          </Card.Text>
          <Button className="mt-8 w-full" onClick={() => window.location.reload()}>
            Retry Connection
          </Button>
        </Card>
      </div>
    );
  }

  if (!username || !node) {
    return <UserPrompt hostname={hostname} />;
  }

  return <SSHConsole hostname={hostname} username={username} node={node} />;
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
  const [ssh, setSsh] = useState<HeadplaneSSH | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Starting tunnel…");

  useEffect(() => {
    let cancelled = false;

    console.log("[ssh] Loading WASM factory");
    loadHeadplaneWASM().then((create) => {
      console.log("[ssh] Factory loaded, creating IPN", create);

      if (cancelled) {
        return;
      }

      setStatus("Joining Tailnet…");
      const instance = create({
        controlURL: node.controlURL,
        preAuthKey: node.preAuthKey,
        hostname: node.ephemeralHostname,
        onReady: () => {
          console.log("[ssh] IPN ready (Running)");
          if (!cancelled) {
            setStatus(`Connecting to ${hostname}…`);
            setSsh(instance);
          }
        },
        onError: (msg) => console.error("[ssh] IPN error:", msg),
      });

      console.log("[ssh] IPN instance created", instance);
    });

    return () => {
      cancelled = true;
    };
  }, [node]);

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {!connected && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-mist-200" />
            <p className="text-sm text-mist-400">{status}</p>
          </div>
        </div>
      )}

      {ssh && (
        <Ghostty
          ssh={ssh}
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
    <div className="flex h-screen w-screen items-center justify-center">
      <SSHErrorBoundary
        title={routeError.title}
        message={routeError.message}
        anchor={routeError.anchor}
      />
    </div>
  );
}
