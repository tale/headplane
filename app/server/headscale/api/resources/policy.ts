import type { Capabilities } from "../capabilities";
import type { Transport } from "../transport";

export interface PolicyApi {
  get(): Promise<{ policy: string; updatedAt: Date | null }>;
  set(policy: string): Promise<{ policy: string; updatedAt: Date }>;
}

export function makePolicyApi(
  transport: Transport,
  _capabilities: Capabilities,
  apiKey: string,
): PolicyApi {
  return {
    get: async () => {
      const { policy, updatedAt } = await transport.request<{
        policy: string;
        updatedAt: string;
      }>({ method: "GET", path: "v1/policy", apiKey });
      return {
        policy,
        updatedAt: updatedAt !== null ? new Date(updatedAt) : null,
      };
    },
    set: async (policy) => {
      const { policy: newPolicy, updatedAt } = await transport.request<{
        policy: string;
        updatedAt: string;
      }>({ method: "PUT", path: "v1/policy", apiKey, body: { policy } });
      return { policy: newPolicy, updatedAt: new Date(updatedAt) };
    },
  };
}
