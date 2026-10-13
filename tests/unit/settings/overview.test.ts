import { describe, expect, test } from "vitest";

import { loader } from "~/routes/settings/overview";
import { headscaleConfigContext } from "~/server/context";

// Only the Headscale config is provided, so gating the restrictions link on
// Headplane's OIDC connector state again (#645) makes the loader throw.
function createMockContext(hasOidcConfig: boolean) {
  return {
    get: (context: unknown) => {
      if (context === headscaleConfigContext) {
        return { hasOIDCConfig: () => hasOidcConfig, writable: () => true };
      }

      throw new Error("Unexpected context key");
    },
  };
}

describe("Settings overview loader", () => {
  test.each([true, false])("reports Headscale OIDC config as %s", async (hasOidcConfig) => {
    const data = await loader({
      context: createMockContext(hasOidcConfig),
    } as unknown as Parameters<typeof loader>[0]);

    expect(data.hasOidcConfig).toBe(hasOidcConfig);
  });
});
