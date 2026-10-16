import { Link as RouterLink } from "react-router";

import Button from "~/components/button";
import Shell from "~/routes/auth/login/shell";

export const sshErrors = {
  wasm_missing: {
    title: "Browser SSH isn't available",
    message: "This build of Headplane doesn't include browser SSH.",
    anchor: "#ssh-not-available",
  },

  agent_required: {
    title: "Browser SSH needs the agent",
    message: "Turn on the Headplane agent to use browser SSH.",
    anchor: "#agent-required",
  },

  oidc_required: {
    title: "Browser SSH needs SSO",
    message: "Sign in with SSO to use browser SSH. API key sessions don't have a Headscale user.",
    anchor: "#oidc-required",
  },

  node_not_found: (hostname: string) => ({
    title: "Machine not found",
    message: `There's no machine named ${hostname}. It may have been renamed or removed.`,
    anchor: "#node-not-found",
  }),

  user_not_linked: {
    title: "Your account isn't linked",
    message:
      "Browser SSH connects as your Headscale user. Ask an administrator to link your account to one.",
    anchor: "#user-not-linked",
  },
} as const;

interface SSHErrorProps {
  title: string;
  message: string;
  anchor: string;
}

export function isSSHError(error: unknown): error is SSHErrorProps {
  return (
    typeof error === "object" &&
    error !== null &&
    "title" in error &&
    "message" in error &&
    "anchor" in error &&
    typeof error.title === "string" &&
    typeof error.message === "string" &&
    typeof error.anchor === "string"
  );
}

export const SSH_DOCS_URL = "https://headplane.net/features/ssh";

export function SSHError({ title, message, anchor }: SSHErrorProps) {
  return (
    <Shell description={message} title={title}>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          nativeButton={false}
          render={<a href={`${SSH_DOCS_URL}${anchor}`} rel="noreferrer" target="_blank" />}
          variant="primary"
        >
          Read the docs
        </Button>
        <Button nativeButton={false} render={<RouterLink reloadDocument to="/" />}>
          Go to Headplane
        </Button>
      </div>
    </Shell>
  );
}
