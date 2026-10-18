import { headscaleContract } from "../../contract/headscale";
import { HEADSCALE_VERSIONS } from "../../harness/versions";
import { createFakeHeadscale } from "../../support/fake-headscale";

for (const version of HEADSCALE_VERSIONS) {
  headscaleContract(version, async () => {
    const { server, headscale, api } = await createFakeHeadscale(version);
    return {
      headscale,
      api,
      apiKey: server.apiKey,
      join: async (options) => server.join(options),
      pendingNode: async (name) => server.pendingNode(name).registerKey,
      dispose: () => headscale.dispose(),
    };
  });
}
