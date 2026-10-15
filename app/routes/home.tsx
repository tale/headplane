import { redirect } from "react-router";

import androidSvg from "~/assets/android.svg";
import iosSvg from "~/assets/ios.svg";
import linuxSvg from "~/assets/linux.svg";
import macosSvg from "~/assets/macos.svg";
import windowsSvg from "~/assets/windows.svg";
import Button from "~/components/button";
import Callout from "~/components/callout";
import CodeBlock from "~/components/code-block";
import Link from "~/components/link";
import PageHeader from "~/components/page-header";
import Section, { Row, RowList } from "~/components/section";
import {
  appConfigContext,
  authContext,
  headscaleConfigContext,
  headscaleLiveStoreContext,
  requestApiContext,
} from "~/server/context";
import { usersResource } from "~/server/headscale/live-store";
import { isUserPrincipal } from "~/server/web/auth";
import { listUnclaimedUsers } from "~/server/web/link";
import { Capabilities } from "~/server/web/roles";

import type { Route } from "./+types/home";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const getRequestApi = context.get(requestApiContext);
  const headscaleConfig = context.get(headscaleConfigContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  const principal = await auth.require(request);

  // An unlinked account picks from the unclaimed Headscale users first.
  let unlinked = false;
  if (isUserPrincipal(principal) && !principal.user.headscaleUserId) {
    const users = await listUnclaimedUsers({ request, context });
    if (users.length > 0) {
      return redirect("/link");
    }

    // With OIDC on the Headscale side, connecting a device creates the user
    // and auto-link picks it up, so there's nothing to warn about.
    if (!headscaleConfig.hasOIDCConfig()) {
      unlinked = true;
    }
  }

  if (auth.can(principal, Capabilities.ui_access)) {
    return redirect("/machines");
  }

  const { api } = await getRequestApi(request);

  let linkedUserName: string | undefined;
  if (isUserPrincipal(principal) && principal.user.headscaleUserId) {
    try {
      const usersSnap = await headscaleLiveStore.get(usersResource, api);
      const hsUser = usersSnap.data.find((u) => u.id === principal.user.headscaleUserId);
      linkedUserName = hsUser?.name;
    } catch {
      // API unavailable, skip linked user resolution
    }
  }

  return {
    linkedUserName,
    server: config.headscale.public_url ?? config.headscale.url,
    unlinked,
  };
}

const downloads = [
  {
    href: "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe",
    icon: windowsSvg,
    label: "Download",
    name: "Windows",
    note: "Windows 10 or later",
  },
  {
    href: "https://pkgs.tailscale.com/stable/Tailscale-latest-macos.pkg",
    icon: macosSvg,
    label: "Download",
    name: "macOS",
    note: "macOS Big Sur or later",
  },
  {
    href: "https://apps.apple.com/us/app/tailscale/id1470499037",
    icon: iosSvg,
    label: "App Store",
    name: "iOS",
    note: "iOS 15 or later",
  },
  {
    href: "https://play.google.com/store/apps/details?id=com.tailscale.ipn",
    icon: androidSvg,
    label: "Google Play",
    name: "Android",
    note: "Android 8 or later",
  },
];

// Shown to accounts without dashboard access, so they can still join the
// tailnet from their own devices.
export default function Home({ loaderData }: Route.ComponentProps) {
  const { linkedUserName, server, unlinked } = loaderData;

  return (
    <>
      <PageHeader
        description={
          <>
            You don't have access to the dashboard, but you can still join the network
            {linkedUserName ? (
              <>
                {" "}
                as <span className="text-fg font-medium">{linkedUserName}</span>
              </>
            ) : null}
            . Ask an administrator if you need more.
          </>
        }
        title="Connect your devices"
      />
      {unlinked && (
        <Callout className="mb-6" title="Your account isn't linked to Headscale" variant="warning">
          Devices can't join until an administrator creates a Headscale user for you.
        </Callout>
      )}
      <Section description="Get the Tailscale client for each device." title="Install Tailscale">
        <RowList>
          <Row>
            <div className="flex items-center gap-3">
              <img alt="" className="w-5 dark:invert" src={linuxSvg} />
              <div>
                <p className="font-medium">Linux</p>
                <p className="text-muted text-xs">
                  Install script.{" "}
                  <Link
                    external
                    styled
                    to="https://github.com/tailscale/tailscale/blob/main/scripts/installer.sh"
                  >
                    View source
                  </Link>
                </p>
              </div>
            </div>
            <CodeBlock className="mt-2 mb-1.5">
              curl -fsSL https://tailscale.com/install.sh | sh
            </CodeBlock>
          </Row>
          {downloads.map((d) => (
            <Row
              action={
                <Button
                  nativeButton={false}
                  render={<a href={d.href} rel="noreferrer" target="_blank" />}
                  size="sm"
                >
                  {d.label}
                </Button>
              }
              key={d.name}
            >
              <div className="flex items-center gap-3">
                <img alt="" className="w-5 dark:invert" src={d.icon} />
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-muted text-xs">{d.note}</p>
                </div>
              </div>
            </Row>
          ))}
        </RowList>
      </Section>
      <Section
        description="Tailscale signs in to tailscale.com by default. Point it at this network instead."
        title="Connect"
      >
        <CodeBlock>{`tailscale up --login-server=${server}`}</CodeBlock>
        <p className="text-muted mt-3 text-sm">
          In the desktop and mobile apps, set a custom coordination server to{" "}
          <span className="text-fg font-medium break-all">{server}</span> before signing in.
        </p>
      </Section>
    </>
  );
}
