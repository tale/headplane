import type { LoaderFunctionArgs } from "react-router";

import { authContext, headscaleLiveStoreContext, requestApiContext } from "~/server/context";
import { usersResource } from "~/server/headscale/live-store";
import type { UserPrincipal } from "~/server/web/auth";
import { findHeadscaleUserBySubject } from "~/server/web/headscale-identity";
import { getUserDisplayName, sortUsersByDisplayName } from "~/utils/user";

type Args = Pick<LoaderFunctionArgs, "request" | "context">;

async function listUnclaimed({ request, context }: Args) {
  const auth = context.get(authContext);
  const liveStore = context.get(headscaleLiveStoreContext);

  try {
    const { api } = await context.get(requestApiContext)(request);
    const [users, claimed] = await Promise.all([
      liveStore.get(usersResource, api),
      auth.claimedHeadscaleUserIds(),
    ]);

    return users.data.filter((u) => !claimed.has(u.id));
  } catch {
    return [];
  }
}

export async function autoLink(args: Args, principal: UserPrincipal) {
  const match = findHeadscaleUserBySubject(
    await listUnclaimed(args),
    principal.user.subject,
    principal.profile.email,
  );

  if (!match) {
    return undefined;
  }

  const isLinked = await args.context
    .get(authContext)
    .linkHeadscaleUser(principal.user.id, match.id);
  return isLinked ? match.id : undefined;
}

export async function listPickableUsers(args: Args) {
  const users = await listUnclaimed(args);
  return sortUsersByDisplayName(users).map((u) => ({ id: u.id, name: getUserDisplayName(u) }));
}
