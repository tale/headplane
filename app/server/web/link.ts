import type { LoaderFunctionArgs } from "react-router";

import { authContext, headscaleLiveStoreContext, requestApiContext } from "~/server/context";
import { usersResource } from "~/server/headscale/live-store";
import { getUserDisplayName, sortUsersByDisplayName } from "~/utils/user";

// Headscale users no Headplane account has claimed yet, for an unlinked
// account to pick from. Empty when Headscale can't be reached.
export async function listUnclaimedUsers({
  request,
  context,
}: Pick<LoaderFunctionArgs, "request" | "context">) {
  const auth = context.get(authContext);
  const getRequestApi = context.get(requestApiContext);
  const liveStore = context.get(headscaleLiveStoreContext);

  try {
    const { api } = await getRequestApi(request);
    const [users, claimed] = await Promise.all([
      liveStore.get(usersResource, api),
      auth.claimedHeadscaleUserIds(),
    ]);

    return sortUsersByDisplayName(users.data.filter((u) => !claimed.has(u.id))).map((u) => ({
      id: u.id,
      name: getUserDisplayName(u),
    }));
  } catch {
    return [];
  }
}
