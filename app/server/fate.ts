import {
  createFateServer,
  createLiveEventBus,
  type SourceDefinition,
  type SourceRegistry,
} from "@nkzw/fate/server";
import type { Context } from "hono";

import type { AppContext } from "./context";
import type { RuntimeApiClient } from "./headscale/api/endpoints";
import type { Principal } from "./web/auth";

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

export const roots = {};
const queries = {};
const lists = {};
const mutations = {};

const registry = new Map() as SourceRegistry<FateContext>;

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
    const principal = await app.auth.require(request);
    const api = app.hsApi.getRuntimeClient(app.auth.getHeadscaleApiKey(principal));

    return {
      api,
      app,
      principal,
      request,
    };
  },
  live,
  roots,
  sources: {
    registry,
    getSource(target) {
      return target as SourceDefinition;
    },
  },
});

export type { FateAdapterContext, FateContext };
