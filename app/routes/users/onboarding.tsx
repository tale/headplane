import { Icon } from "@iconify/react";
import { ArrowRight, Key, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { data, Form, NavLink, useFetcher } from "react-router";

import Button from "~/components/Button";
import Card from "~/components/Card";
import Dialog from "~/components/Dialog";
import Input from "~/components/Input";
import Link from "~/components/link";
import Notice from "~/components/Notice";
import Options from "~/components/Options";
import StatusCircle from "~/components/StatusCircle";
import { findHeadscaleUserBySubject } from "~/server/web/headscale-identity";
import type { Machine } from "~/types";
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
    case "Windows": {
      osValue = "windows";
      break;
    }
    case "Mac OS X": {
      osValue = "macos";
      break;
    }

    case "iPhone":
    case "iPad": {
      osValue = "ios";
      break;
    }

    case "Android": {
      osValue = "android";
      break;
    }

    default: {
      osValue = "linux";
      break;
    }
  }

  const headscaleOidcEnabled = !!context.hs.c?.oidc;

  const apiKey = context.auth.getHeadscaleApiKey(principal, context.oidc?.apiKey);
  const api = context.hsApi.getRuntimeClient(apiKey);

  const hsUserId = principal.user.headscaleUserId;
  let firstMachine: Machine | undefined;
  let needsUserLink = false;
  let linkedUserName: string | undefined;
  let headscaleUsers: { id: string; name: string }[] = [];

  try {
    const [nodes, apiUsers] = await Promise.all([api.getNodes(), api.getUsers()]);

    headscaleUsers = apiUsers.map((u) => ({
      id: u.id,
      name: getUserDisplayName(u),
    }));

    if (hsUserId) {
      const hsUser = apiUsers.find((u) => u.id === hsUserId);
      linkedUserName = hsUser ? getUserDisplayName(hsUser) : undefined;
      firstMachine = nodes.find((n) => n.user?.id === hsUserId);
    } else if (headscaleOidcEnabled) {
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
  } catch (error) {
    log.debug("api", "Failed to lookup nodes %o", error);
  }

  return {
    firstMachine,
    headscaleOidcEnabled,
    headscaleUsers,
    linkedUserName,
    needsUserLink,
    osValue,
    user: {
      subject: principal.user.subject,
      name: principal.profile.name,
      email: principal.profile.email,
      username: principal.profile.username,
      picture: principal.profile.picture,
    },
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const principal = await context.auth.require(request);
  if (principal.kind !== "oidc") {
    throw data({ error: "Onboarding actions require OIDC authentication" }, { status: 403 });
  }

  const apiKey = context.auth.getHeadscaleApiKey(principal, context.oidc?.apiKey);
  const api = context.hsApi.getRuntimeClient(apiKey);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "register-node") {
    const nodeKey = formData.get("nodeKey");
    const userId = formData.get("userId");

    if (!nodeKey || typeof nodeKey !== "string") {
      return data({ error: "Node key is required" }, { status: 400 });
    }

    if (!userId || typeof userId !== "string") {
      return data({ error: "User is required" }, { status: 400 });
    }

    try {
      const machine = await api.registerNode(userId, nodeKey);
      return { success: true, machine };
    } catch (e) {
      log.error("api", "Failed to register node: %o", e);
      return data(
        { error: "Failed to register node. Check that the node key is valid." },
        { status: 500 },
      );
    }
  }

  if (intent === "create-user") {
    const username = formData.get("username");

    if (!username || typeof username !== "string") {
      return data({ error: "Username is required" }, { status: 400 });
    }

    try {
      const user = await api.createUser(
        username,
        principal.profile.email,
        principal.profile.name,
        principal.profile.picture,
      );
      return { success: true, user };
    } catch (e) {
      log.error("api", "Failed to create user: %o", e);
      return data(
        { error: "Failed to create user. The username may already exist." },
        { status: 500 },
      );
    }
  }

  return data({ error: "Invalid intent" }, { status: 400 });
}

export default function Page({
  loaderData: {
    user,
    osValue,
    firstMachine,
    headscaleOidcEnabled,
    headscaleUsers,
    linkedUserName,
    needsUserLink,
  },
}: Route.ComponentProps) {
  const { pause, resume } = useLiveData();
  const fetcher = useFetcher();
  const [nodeKeyDialogOpen, setNodeKeyDialogOpen] = useState(false);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [nodeKey, setNodeKey] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newUsername, setNewUsername] = useState("");

  useEffect(() => {
    if (firstMachine) {
      pause();
    } else if (headscaleOidcEnabled) {
      resume();
    }
  }, [firstMachine, headscaleOidcEnabled]);

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.machine) {
        toast("Device registered successfully!");
        setNodeKeyDialogOpen(false);
        setNodeKey("");
        setSelectedUserId("");
      }
      if (fetcher.data.user) {
        toast("User created successfully!");
        setCreateUserDialogOpen(false);
        setNewUsername("");
      }
    }
  }, [fetcher.data]);

  const subject = user.email ? (
    <>
      as <strong>{user.email}</strong>
    </>
  ) : (
    "with your OIDC provider"
  );

  const isSubmitting = fetcher.state === "submitting";

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
            {headscaleOidcEnabled ? (
              <>
                Install Tailscale and sign in {subject}. Once you sign in on a device, it will be
                automatically added to your Headscale network.
              </>
            ) : (
              "Install Tailscale and sign in with your Headscale user. Once you sign in on a device, it will be ready to connect."
            )}
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
                  external
                  styled
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
                <Link external styled to="https://apps.apple.com/ca/app/tailscale/id1475387142">
                  macOS App Store
                </Link>
                .
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
          ) : headscaleOidcEnabled ? (
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
              <p className="text-center text-sm text-mist-600 dark:text-mist-300">
                Or use the option below
              </p>
              <div className="mt-4 flex w-full flex-col gap-2">
                <Button
                  className="flex w-full items-center justify-center gap-2"
                  variant="light"
                  onPress={() => setNodeKeyDialogOpen(true)}
                >
                  <Key className="size-4" />
                  Register with Node Key
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <Card.Title className="text-center">Connect Your Device</Card.Title>
              <p className="text-center text-sm text-mist-600 dark:text-mist-300">
                Since Headscale is not using OIDC, you can register devices manually or create a
                Headscale user.
              </p>
              <div className="mt-4 flex w-full flex-col gap-2">
                <Button
                  className="flex w-full items-center justify-center gap-2"
                  variant="heavy"
                  onPress={() => setNodeKeyDialogOpen(true)}
                >
                  <Key className="size-4" />
                  Register with Node Key
                </Button>
                <Button
                  className="flex w-full items-center justify-center gap-2"
                  variant="light"
                  onPress={() => setCreateUserDialogOpen(true)}
                >
                  <UserPlus className="size-4" />
                  Create Headscale User
                </Button>
              </div>
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

      <Dialog isOpen={nodeKeyDialogOpen} onOpenChange={setNodeKeyDialogOpen}>
        <Dialog.Panel>
          <Dialog.Title>Register Device with Node Key</Dialog.Title>
          <Dialog.Text>
            Enter the node key from your Tailscale client to register it with Headscale. You can get
            this by running{" "}
            <code className="rounded bg-mist-100 px-1 dark:bg-mist-800">
              tailscale debug nodekey
            </code>
            .
          </Dialog.Text>
          <fetcher.Form method="POST" className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="intent" value="register-node" />
            <Input
              label="Node Key"
              name="nodeKey"
              placeholder="nodekey:..."
              value={nodeKey}
              onChange={(v) => setNodeKey(v)}
              isRequired
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Assign to User</label>
              <select
                name="userId"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className={cn(
                  "rounded-lg border px-3 py-2",
                  "border-mist-200 dark:border-mist-700",
                  "bg-mist-50 dark:bg-mist-900",
                )}
                required
              >
                <option value="">Select a user...</option>
                {headscaleUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            {fetcher.data?.error && <Notice variant="error">{fetcher.data.error}</Notice>}
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="light" onPress={() => setNodeKeyDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="heavy" isDisabled={isSubmitting}>
                {isSubmitting ? "Registering..." : "Register Device"}
              </Button>
            </div>
          </fetcher.Form>
        </Dialog.Panel>
      </Dialog>

      <Dialog isOpen={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
        <Dialog.Panel>
          <Dialog.Title>Create Headscale User</Dialog.Title>
          <Dialog.Text>
            Create a new Headscale user that you can use to register devices.
          </Dialog.Text>
          <fetcher.Form method="POST" className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="intent" value="create-user" />
            <Input
              label="Username"
              name="username"
              placeholder="Enter a username"
              value={newUsername}
              onChange={(v) => setNewUsername(v)}
              isRequired
            />
            {fetcher.data?.error && <Notice variant="error">{fetcher.data.error}</Notice>}
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="light" onPress={() => setCreateUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="heavy" isDisabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create User"}
              </Button>
            </div>
          </fetcher.Form>
        </Dialog.Panel>
      </Dialog>
    </div>
  );
}
