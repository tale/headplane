import { Icon } from "@iconify/react";
import { Form, Outlet, redirect } from "react-router";

import Button from "~/components/Button";
import Card from "~/components/Card";
import Footer from "~/components/Footer";
import Header from "~/components/Header";
import Link from "~/components/Link";
import Options from "~/components/Options";
import { Capabilities } from "~/server/web/roles";
import toast from "~/utils/toast";
import { getUserDisplayName } from "~/utils/user";

import { Route } from "./+types/shell";

// This loads the bare minimum for the application to function
// So we know that if context fails to load then well, oops?
export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    const principal = await context.auth.require(request);

    if (
      typeof context.oidc === "object" &&
      principal.kind === "oidc" &&
      !principal.user.onboarded &&
      !request.url.endsWith("/onboarding")
    ) {
      return redirect("/onboarding");
    }

    const apiKey = context.auth.getHeadscaleApiKey(principal, context.oidc?.apiKey);
    const api = context.hsApi.getRuntimeClient(apiKey);
    const check = context.auth.can(principal, Capabilities.ui_access);
    const noAccess = !check && principal.kind === "oidc";

    const user =
      principal.kind === "oidc"
        ? {
            subject: principal.user.subject,
            name: principal.profile.name,
            email: principal.profile.email,
            username: principal.profile.username,
            picture: principal.profile.picture,
          }
        : { subject: "api_key", name: principal.displayName };

    let linkedUserName: string | undefined;
    let osValue: string | undefined;

    if (noAccess && principal.kind === "oidc") {
      const hsUserId = principal.user.headscaleUserId;
      if (hsUserId) {
        try {
          const apiUsers = await api.getUsers();
          const hsUser = apiUsers.find((u) => u.id === hsUserId);
          linkedUserName = hsUser ? getUserDisplayName(hsUser) : undefined;
        } catch {
          // API unavailable, skip linked user resolution
        }
      }

      const userAgent = request.headers.get("user-agent");
      const os = userAgent?.match(/(Linux|Windows|Mac OS X|iPhone|iPad|Android)/);
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
    }

    return {
      config: context.hs.c,
      url: context.config.headscale.public_url ?? context.config.headscale.url,
      configAvailable: context.hs.readable(),
      debug: context.config.debug,
      user,
      access: {
        ui: check,
        dns: context.auth.can(principal, Capabilities.read_network),
        users: context.auth.can(principal, Capabilities.read_users),
        policy: context.auth.can(principal, Capabilities.read_policy),
        machines: context.auth.can(principal, Capabilities.read_machines),
        settings: context.auth.can(principal, Capabilities.read_feature),
      },
      onboarding: request.url.endsWith("/onboarding"),
      noAccess,
      linkedUserName,
      osValue,
      healthy: await api.isHealthy(),
    };
  } catch {
    return redirect("/login", {
      headers: {
        "Set-Cookie": await context.auth.destroySession(request),
      },
    });
  }
}

export default function Shell({ loaderData }: Route.ComponentProps) {
  if (loaderData.noAccess && !loaderData.onboarding) {
    return (
      <>
        <Header {...loaderData} />
        <main className="container mx-auto mt-4 mb-24 overscroll-contain">
          <div className="mx-auto mt-12 grid w-fit grid-cols-1 gap-4 md:grid-cols-2">
            {loaderData.linkedUserName ? (
              <Card className="col-span-1 mx-auto max-w-lg md:col-span-2" variant="flat">
                <p className="text-sm">
                  ✓ Your account is linked to Headscale user{" "}
                  <strong>{loaderData.linkedUserName}</strong>.
                </p>
              </Card>
            ) : undefined}
            <Card className="max-w-lg" variant="flat">
              <Card.Title className="mb-8">
                Access your network
                <br />
                via Tailscale
              </Card.Title>
              <Card.Text>
                You don't have dashboard access, but you can still connect to your Headscale
                network. Install Tailscale on your device to get started.
              </Card.Text>

              <Options
                className="my-4"
                defaultSelectedKey={loaderData.osValue ?? "linux"}
                label="Download Selector"
              >
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
            <Card className="max-w-lg" variant="flat">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <Card.Title className="mb-4">Need dashboard access?</Card.Title>
                  <Card.Text>
                    Your account is signed in but doesn't have permission to manage the dashboard.
                    Contact an administrator to request access.
                  </Card.Text>
                </div>
                <Form action="/logout" className="mt-6" method="POST">
                  <Button className="w-full" type="submit" variant="light">
                    Sign out
                  </Button>
                </Form>
              </div>
            </Card>
          </div>
        </main>
        <Footer {...loaderData} />
      </>
    );
  }

  return (
    <>
      <Header {...loaderData} />
      <Outlet />
      <Footer {...loaderData} />
    </>
  );
}
