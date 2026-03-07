import { ClockIcon, LogOut, RefreshCw, UserCheck } from "lucide-react";
import { Form, redirect } from "react-router";

import Button from "~/components/Button";
import Card from "~/components/Card";
import { Capabilities } from "~/server/web/roles";
import toast from "~/utils/toast";

import type { Route } from "./+types/pending-approval";

export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    const session = await context.sessions.auth(request);

    // API key users skip this page
    if (session.user.subject === "unknown-non-oauth") {
      return redirect("/machines");
    }

    const hasAccess = await context.sessions.check(request, Capabilities.ui_access);
    if (hasAccess) {
      return redirect("/machines");
    }

    const url = context.config.headscale.public_url ?? context.config.headscale.url;

    return {
      user: session.user,
      url,
    };
  } catch {
    return redirect("/login", {
      headers: {
        "Set-Cookie": await context.sessions.destroySession(),
      },
    });
  }
}

export default function PendingApproval({ loaderData }: Route.ComponentProps) {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Card className="m-4 max-w-md sm:m-0">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900">
            <ClockIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <Card.Title className="mb-0 text-xl">Approval Required</Card.Title>
            <p className="text-headplane-500 text-sm">
              {loaderData.user.email ?? loaderData.user.name}
            </p>
          </div>
        </div>

        <Card.Text className="mb-4">
          Your account has been created but requires approval from an administrator before you can
          access the management console.
        </Card.Text>

        <div className="bg-headplane-50 dark:bg-headplane-900 mb-4 rounded-lg p-4">
          <div className="mb-2 flex items-center gap-2">
            <UserCheck className="text-headplane-500 h-5 w-5" />
            <p className="font-medium">What happens next?</p>
          </div>
          <ul className="text-headplane-600 dark:text-headplane-400 list-inside list-disc space-y-1 text-sm">
            <li>An administrator will review your account</li>
            <li>Once approved, you will receive the appropriate access level</li>
            <li>This page will automatically redirect you once approved</li>
          </ul>
        </div>

        <Card.Text className="mb-4 text-sm">
          In the meantime, you can still connect your devices to the Tailnet using the command
          below:
        </Card.Text>

        <Button
          className="w-full font-mono text-sm"
          variant="light"
          onPress={async () => {
            await navigator.clipboard.writeText(`tailscale up --login-server=${loaderData.url}`);
            toast("Copied to clipboard");
          }}
        >
          tailscale up --login-server={loaderData.url}
        </Button>
        <p className="mt-1 text-center text-xs opacity-50">Click to copy the command</p>

        <div className="bg-headplane-100 dark:bg-headplane-800 mb-4 flex items-center justify-center gap-2 rounded-lg p-3 text-sm">
          <RefreshCw className="text-headplane-500 h-4 w-4 animate-spin" />
          <span className="text-headplane-600 dark:text-headplane-400">
            Checking for approval automatically...
          </span>
        </div>

        <Form action="/logout" method="post">
          <Button
            type="submit"
            variant="heavy"
            className="flex w-full items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </Form>
      </Card>
    </div>
  );
}
