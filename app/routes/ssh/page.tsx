import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { preload } from "react-dom";
import { data, isRouteErrorResponse, type ShouldRevalidateFunction, useHref } from "react-router";

import Button from "~/components/button";
import Callout from "~/components/callout";
import Code from "~/components/code";
import Link from "~/components/link";
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
import { connectTailnet, MissingWasmError } from "./wasm.client";

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

export default function Page({ loaderData }: Route.ComponentProps) {
  const { hostname, username, offline, node, compatibilityWarning } = loaderData;
  const wasmUrl = useHref("/hp_ssh.wasm");
  preload(wasmUrl, { as: "fetch", type: "application/wasm", crossOrigin: "anonymous" });

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
      <SSHConsole hostname={hostname} username={username} node={node} wasmUrl={wasmUrl} />
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
  wasmUrl,
}: {
  hostname: string;
  username: string;
  wasmUrl: string;
  node: { ipAddress: string; controlURL: string; preAuthKey: string; ephemeralHostname: string };
}) {
  const [ipn, setIpn] = useState<IPN | null>(null);
  const [isTerminalShown, setIsTerminalShown] = useState(false);
  const [isWasmMissing, setIsWasmMissing] = useState(false);
  const [authUrl, setAuthUrl] = useState<string>();
  const [status, setStatus] = useState("Joining Tailnet…");
  const wasmHelperUrl = useHref("/wasm_exec.js");

  // Stable, so the terminal isn't torn down and reconnected on re-render.
  const showTerminal = useCallback(() => setIsTerminalShown(true), []);
  const onOutput = useCallback((output: string) => {
    // Errors and check rules' sign-in banners arrive before the session.
    setIsTerminalShown(true);
    const url = output.match(/To authenticate, visit: (\S+)/)?.[1];
    if (url) setAuthUrl(url);
  }, []);

  useEffect(() => {
    let cancelled = false;

    connectTailnet({
      controlURL: node.controlURL,
      authKey: node.preAuthKey,
      hostname: node.ephemeralHostname,
      wasmUrl,
      wasmHelperUrl,
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
        if (error instanceof MissingWasmError) {
          setIsWasmMissing(true);
          return;
        }

        setStatus(`Failed to join Tailnet: ${error instanceof Error ? error.message : error}`);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [node, hostname, wasmUrl, wasmHelperUrl]);

  if (isWasmMissing) {
    return <SSHError {...sshErrors.wasm_missing} />;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {authUrl && (
        <Callout className="m-4" title="Sign in to continue" variant="warning">
          {hostname} needs you to sign in again before it opens the session.{" "}
          <Link external styled to={authUrl}>
            Sign in
          </Link>
        </Callout>
      )}
      {!isTerminalShown && (
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
          onConnected={showTerminal}
          onOutput={onOutput}
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
