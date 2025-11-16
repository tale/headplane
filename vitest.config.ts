import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const prefix = process.env.__INTERNAL_PREFIX || '/admin';
if (prefix.endsWith('/')) {
	throw new Error('Prefix must not end with a slash');
}

// Load the version via package.json
const pkg = await readFile('package.json', 'utf-8');
const isNext = process.env.IMAGE_TAG?.includes('next');
const { version } = JSON.parse(pkg);
if (!version) {
	throw new Error('Unable to read version from package.json');
}

export default defineConfig(({ mode }) => ({
	test: {
		env: {
			HEADPLANE_DEBUG_LOG: 'true',
		},
		// bail: mode === 'integration' ? 1 : undefined,
		environment: 'node',
		include:
			mode === 'integration'
				? ['tests/integration/*.test.ts']
				: ['tests/**/*.test.js'],
		exclude: ['node_modules/**', 'build/**'],
		setupFiles:
			mode === 'integration'
				? ['./tests/integration/setup/vitest-hook.ts']
				: ['./tests/setupOverlayFs.js'],
	},
	resolve: {
		alias: {
			'~': resolve(__dirname, './app'),
		},
	},
	define: {
		__VERSION__: JSON.stringify(isNext ? `${version}-next` : version),
		__PREFIX__: JSON.stringify(prefix),
	},
}));
