import { defineConfig } from 'drizzle-kit';
export default defineConfig({
	dialect: 'sqlite',
	schema: './app/server/db/schema.ts',
	dbCredentials: {
		url: 'file:test/hp_persist.db',
	},
});
