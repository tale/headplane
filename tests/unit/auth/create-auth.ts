import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

import { AuthService } from "~/server/web/auth";

export function createTestAuth() {
  const db = drizzle(":memory:");
  migrate(db, { migrationsFolder: "./drizzle" });

  const auth = new AuthService({
    secret: "test-secret-key-for-unit-tests",
    db,
    cookie: {
      name: "_hp_test",
      secure: false,
      maxAge: 3600,
    },
  });

  return { auth, db };
}
