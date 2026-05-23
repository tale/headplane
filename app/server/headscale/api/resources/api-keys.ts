import type { Key } from "~/types";

import type { Capabilities } from "../capabilities";
import type { Transport } from "../transport";

export interface ApiKeyApi {
  list(): Promise<Key[]>;
}

export function makeApiKeyApi(
  transport: Transport,
  _capabilities: Capabilities,
  apiKey: string,
): ApiKeyApi {
  return {
    list: async () => {
      const { apiKeys } = await transport.request<{ apiKeys: Key[] }>({
        method: "GET",
        path: "v1/apikey",
        apiKey,
      });
      return apiKeys;
    },
  };
}
