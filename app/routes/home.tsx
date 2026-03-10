import { Check, Copy } from "lucide-react";
import { Form, redirect } from "react-router";

import androidSvg from "~/assets/android.svg";
import iosSvg from "~/assets/ios.svg";
import linuxSvg from "~/assets/linux.svg";
import macosSvg from "~/assets/macos.svg";
import windowsSvg from "~/assets/windows.svg";
import Button from "~/components/Button";
import Card from "~/components/Card";
import Link from "~/components/link";
import { Capabilities } from "~/server/web/roles";
import cn from "~/utils/cn";
import toast from "~/utils/toast";

import type { Route } from "./+types/home";

export async function loader({ request, context }: Route.LoaderArgs) {
  const principal = await context.auth.require(request);

  if (context.auth.can(principal, Capabilities.ui_access)) {
    return redirect("/machines");
  }

  const apiKey = context.auth.getHeadscaleApiKey(principal, context.oidc?.apiKey);
  const api = context.hsApi.getRuntimeClient(apiKey);

  let linkedUserName: string | undefined;
  if (principal.kind === "oidc" && principal.user.headscaleUserId) {
    try {
      const users = await api.getUsers();
      const hsUser = users.find((u) => u.id === principal.user.headscaleUserId);
      linkedUserName = hsUser?.name;
    } catch {
      // API unavailable, skip linked user resolution
    }
  }

  return { linkedUserName };
}

const downloads = [
  {
    href: "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe",
    icon: windowsSvg,
    name: "Windows",
    note: "Windows 10+",
  },
  {
    href: "https://pkgs.tailscale.com/stable/Tailscale-latest-macos.pkg",
    icon: macosSvg,
    name: "macOS",
    note: "macOS Big Sur+",
  },
  {
    href: "https://apps.apple.com/us/app/tailscale/id1470499037",
    icon: iosSvg,
    name: "iOS",
    note: "iOS 15+",
  },
  {
    href: "https://play.google.com/store/apps/details?id=com.tailscale.ipn",
    icon: androidSvg,
    name: "Android",
    note: "Android 8+",
  },
];

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <div className="mx-auto mt-6 mb-24 flex max-w-2xl flex-col gap-4">
      {loaderData.linkedUserName && (
        <Card variant="raised" className="flex max-w-2xl items-center gap-4">
          <Check className="inline-flex size-4" />
          <Card.Text className="text-sm">
            Your account is linked to Headscale user <strong>{loaderData.linkedUserName}</strong>.
          </Card.Text>
        </Card>
      )}
      <Card variant="flat" className="max-w-2xl">
        <Card.Title>Access your network via Tailscale</Card.Title>
        <Card.Text className="mt-1">
          You've successfully authenticated but don't have access to the dashboard. You can still
          connect to your Headscale network by installing Tailscale.
        </Card.Text>

        <div className="mt-4 rounded-lg border border-mist-200 p-3 dark:border-mist-700">
          <div className="flex items-center gap-2">
            <img alt="Linux" className="w-4" src={linuxSvg} />
            <span className="text-sm font-medium">Linux</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-xs h-8",
                "bg-mist-100 dark:bg-mist-800",
              )}
            >
              curl -fsSL https://tailscale.com/install.sh | sh
            </code>
            <Button
              className="h-8 p-1 px-2"
              variant="ghost"
              onPress={async () => {
                await navigator.clipboard.writeText(
                  "curl -fsSL https://tailscale.com/install.sh | sh",
                );
                toast("Copied to clipboard");
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-mist-500 dark:text-mist-400">
            <Link
              external
              styled
              to="https://github.com/tailscale/tailscale/blob/main/scripts/installer.sh"
            >
              View script source
            </Link>
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {downloads.map((dl) => (
            <a
              key={dl.name}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg p-3",
                "border border-mist-200 dark:border-mist-700",
                "hover:bg-mist-100 dark:hover:bg-mist-800",
                "focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-1",
                "dark:focus:ring-indigo-400/40 dark:focus:ring-offset-mist-900",
                "transition-colors",
              )}
              href={dl.href}
              rel="noreferrer"
              target="_blank"
            >
              <img alt={dl.name} className="h-6" src={dl.icon} />
              <span className="text-sm font-medium">{dl.name}</span>
              <span className="text-xs text-mist-500 dark:text-mist-400">{dl.note}</span>
            </a>
          ))}
        </div>
        <Card.Text className="mt-8 text-center text-xs text-mist-600 dark:text-mist-300">
          Need access to the dashboard? Contact your administrator to request access.
        </Card.Text>
      </Card>
    </div>
  );
}
