import { readFile } from 'node:fs/promises';
import { reactRouter } from '@react-router/dev/vite';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';
import tsconfigPaths from 'vite-tsconfig-paths';

const prefix = process.env.__INTERNAL_PREFIX || '/admin';
if (prefix.endsWith('/')) {
	throw new Error('Prefix must not end with a slash');
}

// Load the version via package.json
const pkg = await readFile('package.json', 'utf-8');
const { version } = JSON.parse(pkg);
if (!version) {
	throw new Error('Unable to read version from package.json');
}

export default defineConfig({
	base: `${prefix}/`,
	plugins: [reactRouter(), tsconfigPaths()],
	css: {
		postcss: {
			plugins: [tailwindcss, autoprefixer],
		},
	},
	define: {
		__VERSION__: JSON.stringify(version),
		__PREFIX__: JSON.stringify(prefix),
	},
});
