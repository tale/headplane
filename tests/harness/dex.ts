import tc from "testcontainers";

import { DEX_IMAGE } from "./versions";

export async function startDex() {
  const container = await new tc.GenericContainer(DEX_IMAGE)
    .withExposedPorts(5556)
    .withEnvironment({
      DEX_ISSUER: "http://0.0.0.0:5556",
      DEX_ENABLE_PASSWORD_DB: "true",
      DEX_OAUTH2_SKIP_APPROVAL_SCREEN: "true",
    })
    .withWaitStrategy(tc.Wait.forLogMessage("listening on", 1).withStartupTimeout(30_000))
    .start();

  // Reachable from the host, unlike the issuer Dex advertises.
  const issuerUrl = `http://${container.getHost()}:${container.getMappedPort(5556)}`;
  return { container, issuerUrl };
}
