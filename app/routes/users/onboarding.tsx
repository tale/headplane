import { Icon } from "@iconify/react";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { Form, NavLink } from "react-router";

import Button from "~/components/Button";
import Card from "~/components/Card";
import Link from "~/components/Link";
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
  let headscaleUsers: { id: string; name: string }[] = [];

  try {
    const [nodes, apiUsers] = await Promise.all([api.getNodes(), api.getUsers()]);

    if (hsUserId) {
      firstMachine = nodes.find((n) => n.user?.id === hsUserId);
    } else {
      const matched = findHeadscaleUserBySubject(
        apiUsers,
        principal.user.subject,
        principal.profile.email,
      );

      if (matched) {
        await context.auth.linkHeadscaleUser(principal.user.id, matched.id);
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
    headscaleUsers,
  };
}

export default function Page({
  loaderData: { user, osValue, firstMachine, needsUserLink, headscaleUsers },
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
        {needsUserLink && headscaleUsers.length > 0 ? (
          <Card className="col-span-2 mx-auto max-w-lg" variant="flat">
            <Card.Title className="mb-4">Link your Headscale account</Card.Title>
            <Card.Text className="mb-4">
              Headplane couldn't automatically match your SSO identity to a Headscale user. Select
              which Headscale user you are to continue.
            </Card.Text>
            <Form method="POST" action="/onboarding/skip">
              <select
                className={cn(
                  "w-full rounded-lg border p-2 mb-4",
                  "border-headplane-200 dark:border-headplane-700",
                  "bg-headplane-50 dark:bg-headplane-900",
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
              <p className="text-headplane-600 dark:text-headplane-300 mt-1 text-center text-xs">
                Click this button to copy the command.{" "}
                <Link
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
              <p className="text-headplane-600 dark:text-headplane-300 text-center text-sm">
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
              <p className="text-headplane-600 dark:text-headplane-300 text-center text-sm">
                Requires macOS Big Sur 11.0 or later.
                <br />
                You can also download Tailscale on the{" "}
                <Link
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
              <p className="text-headplane-600 dark:text-headplane-300 text-center text-sm">
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
              <p className="text-headplane-600 dark:text-headplane-300 text-center text-sm">
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
              <div className="border-headplane-100 dark:border-headplane-800 rounded-xl border p-4">
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
                    "bg-headplane-500",
                  )}
                />
                <span
                  className={cn("relative inline-flex size-4 rounded-full", "bg-headplane-400")}
                />
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
