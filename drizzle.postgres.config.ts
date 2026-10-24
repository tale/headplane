import { defineConfig } from "drizzle-kit";

// PostgreSQL migrations live in their own folder. The SQLite migrations stay
// where they are: existing installs have already applied them, and both
// `client.server.ts` and the test helpers reference `./drizzle` directly.
export default defineConfig({
  dialect: "postgresql",
  schema: "./app/server/db/schema.postgres.ts",
  out: "./drizzle/postgres",
});
