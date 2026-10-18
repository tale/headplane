import { headscaleContract } from "../../contract/headscale";
import { createTailnet } from "../../harness/tailnet";
import { testedVersions } from "../../harness/versions";

for (const version of testedVersions()) {
  headscaleContract(
    version,
    async () => {
      const tailnet = await createTailnet({ version });
      return {
        headscale: tailnet.hs,
        api: tailnet.api,
        apiKey: tailnet.headscale.apiKey,
        join: async (options) => tailnet.node(options),
        pendingNode: async (name) => {
          const node = await tailnet.pendingNode({ name });
          return node.registerUrl.split("/register/")[1];
        },
        dispose: () => tailnet.dispose(),
      };
    },
    { isReal: true },
  );
}
