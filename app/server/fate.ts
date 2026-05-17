import {
  createFateServer,
  createLiveEventBus,
  dataView,
  FateRequestError,
  list,
  resolveSourceById,
  type Entity,
  type SourceDefinition,
  type SourceRegistry,
} from "@nkzw/fate/server";
import type { Context } from "hono";

import type { Machine as HeadscaleMachine, User as HeadscaleUser } from "~/types";

import type { AppContext } from "./context";
import type { RuntimeApiClient } from "./headscale/api/endpoints";
import { isConnectionError, isDataWithApiError } from "./headscale/api/error-client";
import { nodesResource } from "./headscale/live-store";
import type { Principal } from "./web/auth";
import { Capabilities } from "./web/roles";

export interface HonoFateEnv {
  Variables: {
    appContext: AppContext;
  };
}

interface FateContext {
  api: RuntimeApiClient;
  app: AppContext;
  principal: Principal;
  request: Request;
}

type FateAdapterContext = Context<HonoFateEnv>;

export const live = createLiveEventBus();

type UserRecord = HeadscaleUser & Record<string, unknown>;
type MachineRecord = Omit<HeadscaleMachine, "user"> & {
  user?: UserRecord;
} & Record<string, unknown>;

export const UserDataView = dataView<UserRecord>("User")({
  createdAt: true,
  displayName: true,
  email: true,
  id: true,
  name: true,
  profilePicUrl: true,
  provider: true,
  providerId: true,
});

export const MachineDataView = dataView<MachineRecord>("Machine")({
  approvedRoutes: true,
  availableRoutes: true,
  createdAt: true,
  discoKey: true,
  expiry: true,
  givenName: true,
  id: true,
  ipAddresses: true,
  lastSeen: true,
  machineKey: true,
  name: true,
  nodeKey: true,
  online: true,
  registerMethod: true,
  subnetRoutes: true,
  tags: true,
  user: UserDataView,
});

export type User = Entity<typeof UserDataView, "User">;
export type Machine = Entity<
  typeof MachineDataView,
  "Machine",
  {
    user?: User;
  }
>;

export type FateUser = User;
export type FateMachine = Machine;

const userSource = {
  id: "id",
  view: UserDataView,
} satisfies SourceDefinition<UserRecord>;

const machineSource = {
  id: "id",
  view: MachineDataView,
} satisfies SourceDefinition<MachineRecord>;

const machineList = list(MachineDataView, { orderBy: { givenName: "asc" } });
const userList = list(UserDataView, { orderBy: { name: "asc" } });

export const Root = {
  machines: machineList,
  users: userList,
};
export const roots = Root;

const queries = {};
const lists = {};

function apiFailureToFateError(error: unknown, fallback: string): FateRequestError {
  if (error instanceof FateRequestError) {
    return error;
  }

  if (isDataWithApiError(error)) {
    const status = error.data.statusCode;
    if (status === 401) {
      return new FateRequestError("UNAUTHORIZED", "Headscale rejected the current API key.");
    }
    if (status === 403) {
      return new FateRequestError("FORBIDDEN", "Headscale refused this operation.");
    }
    if (status === 404) {
      return new FateRequestError("NOT_FOUND", "The requested Headscale resource was not found.");
    }

    return new FateRequestError(
      "INTERNAL_ERROR",
      `Headscale API request failed with status ${status}.`,
      { status: 502 },
    );
  }

  const data = error && typeof error === "object" && "data" in error ? error.data : undefined;
  if (isConnectionError(data)) {
    return new FateRequestError(
      "INTERNAL_ERROR",
      `Unable to reach Headscale: ${data.errorMessage}`,
      { status: 502 },
    );
  }

  return new FateRequestError("INTERNAL_ERROR", fallback);
}

interface RenameMachineInput {
  id: string;
  name: string;
}

const renameMachineInput = {
  parse(input: unknown): RenameMachineInput {
    if (!input || typeof input !== "object") {
      throw new FateRequestError("VALIDATION_ERROR", "Machine rename input is required.");
    }

    const id = (input as Record<string, unknown>).id;
    const name = (input as Record<string, unknown>).name;
    if (typeof id !== "string" || id.trim() === "") {
      throw new FateRequestError("VALIDATION_ERROR", "Machine ID is required.");
    }
    if (typeof name !== "string" || name.trim() === "") {
      throw new FateRequestError("VALIDATION_ERROR", "Machine name is required.");
    }

    return {
      id,
      name: name.trim(),
    };
  },
};

const mutations = {
  "machine.rename": {
    input: renameMachineInput,
    resolve: async ({
      ctx,
      input,
      select,
    }: {
      ctx: FateContext;
      input: RenameMachineInput;
      select: Array<string>;
    }): Promise<Machine | null> => {
      let node;
      try {
        node = await ctx.api.getNode(input.id);
      } catch (error) {
        throw apiFailureToFateError(error, "Unable to load this machine.");
      }

      if (!ctx.app.auth.canManageNode(ctx.principal, node)) {
        throw new FateRequestError(
          "FORBIDDEN",
          "You do not have permission to rename this machine.",
        );
      }

      try {
        await ctx.api.renameNode(input.id, input.name);
      } catch (error) {
        throw apiFailureToFateError(error, "Unable to rename this machine.");
      }

      void ctx.app.hsLive.refresh(nodesResource, ctx.api).catch(() => undefined);

      const eventId = `machine:${input.id}:rename:${Date.now()}`;
      live.update("Machine", input.id, { changed: ["givenName", "name"], eventId });
      live.connection("machines").invalidate({ eventId });

      return (await resolveSourceById({
        ctx,
        id: input.id,
        input: { select },
        registry,
        source: machineSource,
      })) as Machine | null;
    },
    type: "Machine",
  },
};

type SourceByIdsOptions = {
  ctx: FateContext;
  ids: Array<string>;
};

type SourceConnectionOptions = {
  ctx: FateContext;
  cursor?: string;
  direction: "backward" | "forward";
  take: number;
};

function requireCapability(ctx: FateContext, capability: Capabilities) {
  if (!ctx.app.auth.can(ctx.principal, capability)) {
    throw new FateRequestError("FORBIDDEN", "You do not have permission to view this data.");
  }
}

function compareText(a: string | undefined, b: string | undefined) {
  return (a ?? "").localeCompare(b ?? "", undefined, { numeric: true, sensitivity: "base" });
}

function byRequestedId<T extends { id: string }>(items: Array<T>, ids: Array<string>) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

function pageByCursor<T extends { id: string }>(
  items: Array<T>,
  { cursor, direction, take }: Omit<SourceConnectionOptions, "ctx">,
) {
  if (!cursor) {
    return direction === "backward"
      ? items.slice(Math.max(0, items.length - take))
      : items.slice(0, take);
  }

  const cursorIndex = items.findIndex((item) => item.id === cursor);
  if (cursorIndex < 0) {
    return direction === "backward"
      ? items.slice(Math.max(0, items.length - take))
      : items.slice(0, take);
  }

  if (direction === "backward") {
    return items.slice(Math.max(0, cursorIndex - take), cursorIndex);
  }

  return items.slice(cursorIndex + 1, cursorIndex + 1 + take);
}

async function getMachineRecords(ctx: FateContext): Promise<Array<MachineRecord>> {
  requireCapability(ctx, Capabilities.read_machines);

  try {
    return (await ctx.api.getNodes())
      .map((machine) => machine as MachineRecord)
      .sort(
        (a, b) =>
          compareText(a.givenName || a.name, b.givenName || b.name) || compareText(a.id, b.id),
      );
  } catch (error) {
    throw apiFailureToFateError(error, "Unable to load machines from Headscale.");
  }
}

async function getUserRecords(ctx: FateContext): Promise<Array<UserRecord>> {
  requireCapability(ctx, Capabilities.read_users);

  try {
    return (await ctx.api.getUsers())
      .map((user) => user as UserRecord)
      .sort((a, b) => compareText(a.name, b.name) || compareText(a.id, b.id));
  } catch (error) {
    throw apiFailureToFateError(error, "Unable to load users from Headscale.");
  }
}

const registry = new Map() as SourceRegistry<FateContext>;
registry.set(machineSource as SourceDefinition, {
  byIds: async ({ ctx, ids }: SourceByIdsOptions) =>
    byRequestedId(await getMachineRecords(ctx), ids),
  connection: async ({ ctx, cursor, direction, take }: SourceConnectionOptions) =>
    pageByCursor(await getMachineRecords(ctx), { cursor, direction, take }),
});
registry.set(userSource as SourceDefinition, {
  byIds: async ({ ctx, ids }: SourceByIdsOptions) => byRequestedId(await getUserRecords(ctx), ids),
  connection: async ({ ctx, cursor, direction, take }: SourceConnectionOptions) =>
    pageByCursor(await getUserRecords(ctx), { cursor, direction, take }),
});

const sourceByView = new Map<unknown, SourceDefinition>([
  [MachineDataView, machineSource as SourceDefinition],
  [machineList, machineSource as SourceDefinition],
  [UserDataView, userSource as SourceDefinition],
  [userList, userSource as SourceDefinition],
]);

function isSourceDefinition(target: unknown): target is SourceDefinition {
  return target !== null && typeof target === "object" && "view" in target;
}

export const fate = createFateServer<
  FateContext,
  typeof roots,
  typeof queries,
  typeof lists,
  typeof mutations,
  FateAdapterContext
>({
  context: async ({ adapterContext, request }) => {
    if (!adapterContext) {
      throw new Error("Fate request is missing Hono context");
    }

    const app = adapterContext.get("appContext");
    let principal;
    try {
      principal = await app.auth.require(request);
    } catch {
      throw new FateRequestError("UNAUTHORIZED", "Authentication required.");
    }

    const api = app.hsApi.getRuntimeClient(app.auth.getHeadscaleApiKey(principal));

    return {
      api,
      app,
      principal,
      request,
    };
  },
  live,
  mutations,
  roots,
  sources: {
    registry,
    getSource(target) {
      if (isSourceDefinition(target)) {
        return target;
      }

      const source = sourceByView.get(target);
      if (!source) {
        throw new Error("No Fate source registered for data view");
      }

      return source;
    },
  },
});

export type { FateAdapterContext, FateContext };
