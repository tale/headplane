import { Form, redirect, useNavigation } from "react-router";

import Button from "~/components/button";
import Select from "~/components/select";
import { authContext } from "~/server/context";
import { isUserPrincipal } from "~/server/web/auth";
import { listUnclaimedUsers } from "~/server/web/link";

import type { Route } from "./+types/link";
import Shell from "./login/shell";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);

  let principal: Awaited<ReturnType<typeof auth.require>>;
  try {
    principal = await auth.require(request);
  } catch {
    return redirect("/login");
  }

  if (!isUserPrincipal(principal) || principal.user.headscaleUserId) {
    return redirect("/");
  }

  const users = await listUnclaimedUsers({ request, context });
  if (users.length === 0) {
    return redirect("/");
  }

  return { email: principal.profile.email ?? principal.profile.name, users };
}

export async function action({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const principal = await auth.require(request);
  if (!isUserPrincipal(principal)) {
    return redirect("/");
  }

  const formData = await request.formData();
  const headscaleUserId = formData.get("headscale_user_id")?.toString();
  if (headscaleUserId) {
    await auth.linkHeadscaleUser(principal.user.id, headscaleUserId);
  }

  return redirect("/");
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();

  return (
    <Shell
      description="Headplane couldn't match your sign-in to a Headscale user. Pick the one that's yours."
      title="Link your account"
    >
      <Form className="flex flex-col gap-3" method="POST">
        <Select
          items={loaderData.users.map((u) => ({ value: u.id, label: u.name }))}
          label="Headscale user"
          name="headscale_user_id"
          placeholder="Select a user"
          required
        />
        <Button
          className="w-full"
          pending={navigation.state === "submitting"}
          type="submit"
          variant="primary"
        >
          Link account
        </Button>
      </Form>
      <p className="text-muted mt-6 text-sm">
        Don't see yours? Ask an administrator. Headscale users with the same email as your sign-in
        are linked automatically.
      </p>
      <Form
        action="/logout"
        className="border-line text-muted mt-8 border-t pt-6 text-sm"
        method="POST"
      >
        Signed in as <span className="text-fg">{loaderData.email}</span>.{" "}
        <button className="text-accent focus-ring rounded-sm" type="submit">
          Sign out
        </button>
      </Form>
    </Shell>
  );
}
