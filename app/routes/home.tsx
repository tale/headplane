import { Check, TriangleAlert } from "lucide-react";
import type React from "react";
import { redirect } from "react-router";

import androidSvg from "~/assets/android.svg";
import iosSvg from "~/assets/ios.svg";
import macosSvg from "~/assets/macos.svg";
import windowsSvg from "~/assets/windows.svg";
import Button from "~/components/button";
import CodeBlock from "~/components/code-block";
import Link from "~/components/link";
import {
  appConfigContext,
  authContext,
  headscaleConfigContext,
  headscaleLiveStoreContext,
  requestApiContext,
} from "~/server/context";
import { usersResource } from "~/server/headscale/live-store";
import { isUserPrincipal } from "~/server/web/auth";
import { autoLink } from "~/server/web/link";
import { Capabilities } from "~/server/web/roles";

import type { Route } from "./+types/home";
import Shell, { SignedIn } from "./auth/login/shell";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const headscaleConfig = context.get(headscaleConfigContext);

  let principal: Awaited<ReturnType<typeof auth.require>>;
  try {
    principal = await auth.require(request);
  } catch {
    return redirect("/login");
  }

  // API key sessions always have dashboard access.
  if (!isUserPrincipal(principal)) {
    return redirect("/machines");
  }

  // Retried on every load, so the page links itself once the account's
  // Headscale user appears, like after a device's first SSO sign-in.
  const isLinked = Boolean(principal.user.headscaleUserId);
  if (!isLinked && (await autoLink({ request, context }, principal))) {
    return redirect("/");
  }

  if (auth.can(principal, Capabilities.ui_access)) {
    return redirect("/machines");
  }

  let linkedName: string | undefined;
  if (isLinked) {
    try {
      const { api } = await context.get(requestApiContext)(request);
      const users = await context.get(headscaleLiveStoreContext).get(usersResource, api);
      linkedName = users.data.find((u) => u.id === principal.user.headscaleUserId)?.name;
    } catch {
      // Headscale is unreachable, so show the link without a name
    }
  }

  return {
    email: principal.profile.email ?? principal.profile.name,
    hasHeadscaleSso: headscaleConfig.readable() ? headscaleConfig.hasOIDCConfig() : undefined,
    isLinked,
    linkedName,
    server: config.headscale.public_url ?? config.headscale.url,
  };
}

const downloads = [
  {
    href: "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe",
    icon: windowsSvg,
    name: "Windows",
  },
  {
    href: "https://pkgs.tailscale.com/stable/Tailscale-latest-macos.pkg",
    icon: macosSvg,
    name: "macOS",
  },
  {
    href: "https://apps.apple.com/us/app/tailscale/id1470499037",
    icon: iosSvg,
    name: "iOS",
  },
  {
    href: "https://play.google.com/store/apps/details?id=com.tailscale.ipn",
    icon: androidSvg,
    name: "Android",
  },
];

export default function Home({ loaderData }: Route.ComponentProps) {
  const { email, server } = loaderData;

  return (
    <Shell
      description="You don't have access to the dashboard, but your devices can still join the network."
      isWide
      title="Connect your devices"
    >
      <ol className="flex flex-col gap-6">
        <Step number={1} title="Install Tailscale">
          <div className="flex flex-wrap gap-2">
            {downloads.map((d) => (
              <Button
                key={d.name}
                nativeButton={false}
                render={<a href={d.href} rel="noreferrer" target="_blank" />}
                size="sm"
              >
                <img alt="" className="size-3.5 dark:invert" src={d.icon} />
                {d.name}
              </Button>
            ))}
          </div>
          <p className="text-muted mt-4 mb-2 text-sm">
            On Linux, use the install script (
            <Link
              external
              styled
              to="https://github.com/tailscale/tailscale/blob/main/scripts/installer.sh"
            >
              source
            </Link>
            ):
          </p>
          <CodeBlock>curl -fsSL https://tailscale.com/install.sh | sh</CodeBlock>
        </Step>
        <Step number={2} title="Sign in to this network">
          <CodeBlock>{`tailscale up --login-server=${server}`}</CodeBlock>
          <p className="text-muted mt-2 text-sm">
            Then open the link it prints. In the desktop and mobile apps, set a custom coordination
            server to <span className="text-fg break-all">{server}</span> instead.
          </p>
        </Step>
      </ol>
      <LinkStatus {...loaderData} />
      <SignedIn name={email} />
    </Shell>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3">
      <span className="border-line-strong text-muted flex size-5 items-center justify-center rounded-full border text-xs font-medium">
        {number}
      </span>
      <h2 className="font-medium">{title}</h2>
      <div className="col-start-2 mt-3">{children}</div>
    </li>
  );
}

interface LinkStatusProps {
  hasHeadscaleSso?: boolean;
  isLinked: boolean;
  linkedName?: string;
}

function LinkStatus({ hasHeadscaleSso, isLinked, linkedName }: LinkStatusProps) {
  if (isLinked) {
    return (
      <Status icon={<Check className="text-ok size-4" />}>
        {linkedName ? (
          <>
            Linked as <span className="font-medium">{linkedName}</span>
          </>
        ) : (
          "Your account is linked"
        )}
        {hasHeadscaleSso === false && <Detail>An administrator approves each new device.</Detail>}
      </Status>
    );
  }

  if (hasHeadscaleSso) {
    return (
      <Status
        icon={
          <span className="relative flex size-2">
            <span className="bg-accent absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:animate-none" />
            <span className="bg-accent relative size-2 rounded-full" />
          </span>
        }
      >
        Waiting for your first device…
        <Detail>
          Your account links once a device signs in with single sign-on. Not linking? Ask an
          administrator.
        </Detail>
      </Status>
    );
  }

  return (
    <Status icon={<TriangleAlert className="text-warn size-4" />}>
      Ask an administrator to link your account
      {hasHeadscaleSso === false && <Detail>They'll also approve each new device.</Detail>}
    </Status>
  );
}

function Status({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      aria-live="polite"
      className="bg-subtle mt-6 grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 rounded-md p-3 text-sm"
    >
      <span className="flex h-5 items-center justify-center">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function Detail({ children }: { children: React.ReactNode }) {
  return <p className="text-muted mt-0.5">{children}</p>;
}
