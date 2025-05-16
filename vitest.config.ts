import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['tests/*.test.js'],
	},
	resolve: {
		alias: {
			'~': resolve(__dirname, './app'),
			'~server': resolve(__dirname, './server'),
		},
	},
});
