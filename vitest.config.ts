import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['tests/**/*.test.js'],
		exclude: ['node_modules/**', 'build/**'],
		setupFiles: ['./tests/setupOverlayFs.js'],
	},
	resolve: {
		alias: {
			'~': resolve(__dirname, './app'),
		},
	},
});
