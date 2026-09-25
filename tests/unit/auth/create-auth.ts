import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

import { wrapSqliteClient } from "~/server/db/client.server";
import { createAuthService } from "~/server/web/auth";

export function createTestAuth(
  options: {
    headscaleApiKey?: string;
    proxyAuth?: {
      enabled: boolean;
      allowedCidrs?: string[];
      trustedProxyCidrs?: string[];
      ipHeader?: string;
      userHeader?: string;
      emailHeader?: string;
      nameHeader?: string;
      pictureHeader?: string;
    };
  } = {},
) {
  const client = drizzle(":memory:");
  migrate(client, { migrationsFolder: "./drizzle" });
  const db = wrapSqliteClient(client);

  const auth = createAuthService({
    secret: "test-secret-key-for-unit-tests",
    headscaleApiKey: options.headscaleApiKey,
    proxyAuth: options.proxyAuth,
    db,
    cookie: {
      name: "_hp_test",
      secure: false,
      maxAge: 3600,
    },
  });

  return { auth, db };
}
