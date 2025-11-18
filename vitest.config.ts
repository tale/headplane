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

export default defineConfig({
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					include: ['tests/unit/*.test.ts'],
					setupFiles: ['tests/unit/setup/overlay-fs.ts'],
				},
			},
			{
				extends: true,
				test: {
					name: 'integration',
					include: ['tests/integration/*.test.ts'],
					setupFiles: ['tests/integration/setup/vitest-hook.ts'],
					testTimeout: 15_000,
				},
			},
		],
		env: {
			HEADPLANE_DEBUG_LOG: 'true',
		},
		environment: 'node',
		exclude: ['node_modules/**', 'build/**'],
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
});
