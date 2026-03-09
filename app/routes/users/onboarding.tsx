import { Icon } from "@iconify/react";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { Form, NavLink } from "react-router";

import Button from "~/components/Button";
import Card from "~/components/Card";
import Link from "~/components/link";
import Options from "~/components/Options";
import StatusCircle from "~/components/StatusCircle";
import { findHeadscaleUserBySubject } from "~/server/web/headscale-identity";
import { Machine } from "~/types";
import cn from "~/utils/cn";
import { useLiveData } from "~/utils/live-data";
import log from "~/utils/log";
import toast from "~/utils/toast";
import { getUserDisplayName } from "~/utils/user";

import type { Route } from "./+types/onboarding";

export async function loader({ request, context }: Route.LoaderArgs) {
  const principal = await context.auth.require(request);
  if (principal.kind !== "oidc") {
    throw new Error("Onboarding is only available for OIDC users.");
  }

  const userAgent = request.headers.get("user-agent");
  const os = userAgent?.match(/(Linux|Windows|Mac OS X|iPhone|iPad|Android)/);
  let osValue = "linux";
  switch (os?.[0]) {
    case "Windows":
      osValue = "windows";
      break;
    case "Mac OS X":
      osValue = "macos";
      break;

    case "iPhone":
    case "iPad":
      osValue = "ios";
      break;

    case "Android":
      osValue = "android";
      break;

    default:
      osValue = "linux";
      break;
  }

  const apiKey = context.auth.getHeadscaleApiKey(principal, context.oidc?.apiKey);
  const api = context.hsApi.getRuntimeClient(apiKey);

  const hsUserId = principal.user.headscaleUserId;
  let firstMachine: Machine | undefined;
  let needsUserLink = false;
  let linkedUserName: string | undefined;
  let headscaleUsers: { id: string; name: string }[] = [];

  try {
    const [nodes, apiUsers] = await Promise.all([api.getNodes(), api.getUsers()]);

    if (hsUserId) {
      const hsUser = apiUsers.find((u) => u.id === hsUserId);
      linkedUserName = hsUser ? getUserDisplayName(hsUser) : undefined;
      firstMachine = nodes.find((n) => n.user?.id === hsUserId);
    } else {
      const matched = findHeadscaleUserBySubject(
        apiUsers,
        principal.user.subject,
        principal.profile.email,
      );

      if (matched) {
        await context.auth.linkHeadscaleUser(principal.user.id, matched.id);
        linkedUserName = getUserDisplayName(matched);
        firstMachine = nodes.find((n) => n.user?.id === matched.id);
      } else {
        needsUserLink = true;
        const claimed = await context.auth.claimedHeadscaleUserIds();
        headscaleUsers = apiUsers
          .filter((u) => !claimed.has(u.id))
          .map((u) => ({
            id: u.id,
            name: getUserDisplayName(u),
          }));
      }
    }
  } catch (e) {
    log.debug("api", "Failed to lookup nodes %o", e);
  }

  return {
    user: {
      subject: principal.user.subject,
      name: principal.profile.name,
      email: principal.profile.email,
      username: principal.profile.username,
      picture: principal.profile.picture,
    },
    osValue,
    firstMachine,
    needsUserLink,
    linkedUserName,
    headscaleUsers,
  };
}

export default function Page({
  loaderData: { user, osValue, firstMachine, needsUserLink, linkedUserName, headscaleUsers },
}: Route.ComponentProps) {
  const { pause, resume } = useLiveData();
  useEffect(() => {
    if (firstMachine) {
      pause();
    } else {
      resume();
    }
  }, [firstMachine]);

  const subject = user.email ? (
    <>
      as <strong>{user.email}</strong>
    </>
  ) : (
    "with your OIDC provider"
  );

  return (
    <div className="fixed flex h-screen w-full items-center px-4">
      <div className="mx-auto mb-24 grid w-fit grid-cols-1 gap-4 md:grid-cols-2">
        {needsUserLink ? (
          <Card className="col-span-2 mx-auto max-w-lg" variant="flat">
            <Card.Title className="mb-4">Link your Headscale account</Card.Title>
            <Card.Text className="mb-4">
              Headplane couldn't automatically match your SSO identity to a Headscale user.
              {headscaleUsers.length > 0
                ? " Select which Headscale user you are, or skip to continue without linking."
                : " All Headscale users are already linked. You can skip this step and ask an admin to link your account later."}
            </Card.Text>
            {headscaleUsers.length > 0 ? (
              <Form method="POST" action="/onboarding/skip">
                <select
                  className={cn(
                    "mb-4 w-full rounded-lg border p-2",
                    "border-mist-200 dark:border-mist-700",
                    "bg-mist-50 dark:bg-mist-900",
                  )}
                  name="headscale_user_id"
                  required
                >
                  <option value="">Select a user...</option>
                  {headscaleUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <Button className="w-full" type="submit" variant="heavy">
                  Link and Continue
                </Button>
              </Form>
            ) : undefined}
            <NavLink className="mt-3 block text-center" to="/onboarding/skip">
              <Button className="w-full" variant="light">
                Skip — I'll do this later
              </Button>
            </NavLink>
            <p className="mt-2 text-center text-xs text-mist-500">
              Without linking, you won't be able to see your own machines or generate pre-auth keys.
              An admin can link your account later from the Users page.
            </p>
          </Card>
        ) : undefined}
        {linkedUserName && !needsUserLink ? (
          <Card className="col-span-2 mx-auto max-w-lg" variant="flat">
            <p className="text-sm">
              ✓ Your account has been linked to Headscale user <strong>{linkedUserName}</strong>.
            </p>
          </Card>
        ) : undefined}
        <Card className="max-w-lg" variant="flat">
          <Card.Title className="mb-8">
            Welcome!
            <br />
            Let's get set up
          </Card.Title>
          <Card.Text>
            Install Tailscale and sign in {subject}. Once you sign in on a device, it will be
            automatically added to your Headscale network.
          </Card.Text>

          <Options className="my-4" defaultSelectedKey={osValue} label="Download Selector">
            <Options.Item
              key="linux"
              title={
                <div className="flex items-center gap-1">
                  <Icon className="ml-1 w-4" icon="ion:terminal" />
                  <span>Linux</span>
                </div>
              }
            >
              <Button
                className="text-md flex font-mono"
                onPress={async () => {
                  await navigator.clipboard.writeText(
                    "curl -fsSL https://tailscale.com/install.sh | sh",
                  );

                  toast("Copied to clipboard");
                }}
              >
                curl -fsSL https://tailscale.com/install.sh | sh
              </Button>
              <p className="mt-1 text-center text-xs text-mist-600 dark:text-mist-300">
                Click this button to copy the command.{" "}
                <Link
                  isExternal
                  name="Linux installation script"
                  to="https://github.com/tailscale/tailscale/blob/main/scripts/installer.sh"
                >
                  View script source
                </Link>
              </p>
            </Options.Item>
            <Options.Item
              key="windows"
              title={
                <div className="flex items-center gap-1">
                  <Icon className="ml-1 w-4" icon="mdi:microsoft" />
                  <span>Windows</span>
                </div>
              }
            >
              <a
                aria-label="Download for Windows"
                href="https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"
                rel="noreferrer"
                target="_blank"
              >
                <Button className="my-4 w-full" variant="heavy">
                  Download for Windows
                </Button>
              </a>
              <p className="text-center text-sm text-mist-600 dark:text-mist-300">
                Requires Windows 10 or later.
              </p>
            </Options.Item>
            <Options.Item
              key="macos"
              title={
                <div className="flex items-center gap-1">
                  <Icon className="ml-1 w-4" icon="streamline-logos:mac-finder-logo-solid" />
                  <span>macOS</span>
                </div>
              }
            >
              <a
                aria-label="Download for macOS"
                href="https://pkgs.tailscale.com/stable/Tailscale-latest-macos.pkg"
                rel="noreferrer"
                target="_blank"
              >
                <Button className="my-4 w-full" variant="heavy">
                  Download for macOS
                </Button>
              </a>
              <p className="text-center text-sm text-mist-600 dark:text-mist-300">
                Requires macOS Big Sur 11.0 or later.
                <br />
                You can also download Tailscale on the{" "}
                <Link
                  isExternal
                  name="macOS App Store"
                  to="https://apps.apple.com/ca/app/tailscale/id1475387142"
                >
                  macOS App Store
                </Link>
                {"."}
              </p>
            </Options.Item>
            <Options.Item
              key="ios"
              title={
                <div className="flex items-center gap-1">
                  <Icon className="ml-1 w-4" icon="grommet-icons:apple" />
                  <span>iOS</span>
                </div>
              }
            >
              <a
                aria-label="Download for iOS"
                href="https://apps.apple.com/us/app/tailscale/id1470499037"
                rel="noreferrer"
                target="_blank"
              >
                <Button className="my-4 w-full" variant="heavy">
                  Download for iOS
                </Button>
              </a>
              <p className="text-center text-sm text-mist-600 dark:text-mist-300">
                Requires iOS 15 or later.
              </p>
            </Options.Item>
            <Options.Item
              key="android"
              title={
                <div className="flex items-center gap-1">
                  <Icon className="ml-1 w-4" icon="material-symbols:android" />
                  <span>Android</span>
                </div>
              }
            >
              <a
                aria-label="Download for Android"
                href="https://play.google.com/store/apps/details?id=com.tailscale.ipn"
                rel="noreferrer"
                target="_blank"
              >
                <Button className="my-4 w-full" variant="heavy">
                  Download for Android
                </Button>
              </a>
              <p className="text-center text-sm text-mist-600 dark:text-mist-300">
                Requires Android 8 or later.
              </p>
            </Options.Item>
          </Options>
        </Card>
        <Card variant="flat">
          {firstMachine ? (
            <div className="flex h-full flex-col justify-between">
              <Card.Title className="mb-8">
                Success!
                <br />
                We found your first device
              </Card.Title>
              <div className="rounded-xl border border-mist-100 p-4 dark:border-mist-800">
                <div className="flex items-start gap-4">
                  <StatusCircle className="mt-3 size-6" isOnline={firstMachine.online} />
                  <div>
                    <p className="leading-snug font-semibold">{firstMachine.givenName}</p>
                    <p className="font-mono text-sm opacity-50">{firstMachine.name}</p>
                    <div className="mt-6">
                      <p className="text-sm font-semibold">IP Addresses</p>
                      {firstMachine.ipAddresses.map((ip) => (
                        <p className="font-mono text-xs opacity-50" key={ip}>
                          {ip}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <NavLink to="/onboarding/skip">
                <Button className="w-full" variant="heavy">
                  Continue
                </Button>
              </NavLink>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <span className="relative flex size-4">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full",
                    "rounded-full opacity-75 animate-ping",
                    "bg-mist-500",
                  )}
                />
                <span className={cn("relative inline-flex size-4 rounded-full", "bg-mist-400")} />
              </span>
              <p className="font-lg">Waiting for your first device...</p>
            </div>
          )}
        </Card>
        <NavLink className="col-span-2 mx-auto w-max" to="/onboarding/skip">
          <Button className="flex items-center gap-1">
            I already know what I'm doing
            <ArrowRight className="p-1" />
          </Button>
        </NavLink>
      </div>
    </div>
  );
}
