import tc from "testcontainers";

export interface DexEnv {
  container: tc.StartedTestContainer;
  issuerUrl: string;
}

export async function startDex(): Promise<DexEnv> {
  const container = await new tc.GenericContainer("dexidp/dex:v2.41.1")
    .withExposedPorts(5556)
    .withEnvironment({
      DEX_ISSUER: "http://0.0.0.0:5556",
      DEX_ENABLE_PASSWORD_DB: "true",
      DEX_OAUTH2_SKIP_APPROVAL_SCREEN: "true",
    })
    .withWaitStrategy(tc.Wait.forLogMessage("listening on", 1).withStartupTimeout(30_000))
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5556);

  // Dex's issuer is configured as http://0.0.0.0:5556 inside the
  // container. The external URL uses the mapped port. Discovery
  // will return endpoints with the internal issuer, but that's fine
  // for testing discovery + startFlow. The issuer mismatch is
  // expected and logged at debug level.
  const issuerUrl = `http://${host}:${port}`;

  return { container, issuerUrl };
}
