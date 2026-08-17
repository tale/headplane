import { createServer, type Server } from "node:http";

import { exportJWK, generateKeyPair } from "jose";
import type { JWK } from "jose";

export interface SigningKey {
  kid: string;
  privateKey: CryptoKey;
  jwk: JWK;
}

export interface JwksEnv {
  /** URL of the served key set, for `jwks_url`. */
  url: string;
  /** The key the server publishes on startup. */
  key: SigningKey;
  /** Replaces the published key set, simulating a rotation. */
  publish(keys: SigningKey[]): void;
  /** How many times the endpoint has actually been fetched. */
  fetchCount(): number;
  stop(): Promise<void>;
}

export async function createSigningKey(kid: string): Promise<SigningKey> {
  const { privateKey, publicKey } = await generateKeyPair("ES256");
  const jwk = await exportJWK(publicKey);
  return { kid, privateKey, jwk: { ...jwk, kid, alg: "ES256", use: "sig" } };
}

/**
 * Serves a JWKS over real HTTP.
 *
 * The unit tests inject a key resolver directly, which skips
 * `createRemoteJWKSet` entirely — so the fetching, caching and unknown-key
 * behaviour that production actually depends on is only exercised here.
 */
export async function startJwks(): Promise<JwksEnv> {
  const key = await createSigningKey("test-key-1");
  let published: SigningKey[] = [key];
  let fetches = 0;

  const server: Server = createServer((req, res) => {
    if (!req.url?.startsWith("/jwks")) {
      res.writeHead(404).end();
      return;
    }

    fetches += 1;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ keys: published.map((k) => k.jwk) }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("JWKS server did not bind to a port");
  }

  return {
    url: `http://127.0.0.1:${address.port}/jwks`,
    key,
    publish: (keys) => {
      published = keys;
    },
    fetchCount: () => fetches,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
