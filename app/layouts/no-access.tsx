import { Icon } from "@iconify/react";
import { Form } from "react-router";

import Button from "~/components/Button";
import Card from "~/components/Card";
import Link from "~/components/Link";
import Options from "~/components/Options";
import toast from "~/utils/toast";

interface NoAccessProps {
  linkedUserName?: string;
  osValue?: string;
}

export default function NoAccess({ linkedUserName, osValue }: NoAccessProps) {
  return (
    <main className="container mt-6 mb-24 overscroll-contain">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        {linkedUserName ? (
          <Card className="max-w-xl" variant="flat">
            <p className="text-sm">
              ✓ Your account is linked to Headscale user <strong>{linkedUserName}</strong>.
            </p>
          </Card>
        ) : undefined}
        <Card className="max-w-xl" variant="flat">
          <Card.Title className="mb-3">Access your network via Tailscale</Card.Title>
          <Card.Text>
            You don't have dashboard access, but you can still connect to your Headscale network.
            Install Tailscale on your device to get started.
          </Card.Text>

          <Options
            className="my-4"
            defaultSelectedKey={osValue ?? "linux"}
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
              <p className="mt-1 text-center text-xs text-mist-600 dark:text-mist-300">
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
        <Card className="max-w-xl" variant="flat">
          <Card.Title className="mb-3">Need dashboard access?</Card.Title>
          <Card.Text>
            Your account is signed in but doesn't have permission to manage the dashboard. Contact
            an administrator to request access.
          </Card.Text>
          <Form action="/logout" className="mt-4" method="POST">
            <Button className="w-full" type="submit" variant="light">
              Sign out
            </Button>
          </Form>
        </Card>
      </div>
    </main>
  );
}
