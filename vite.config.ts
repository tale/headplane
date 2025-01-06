import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';
import tsconfigPaths from 'vite-tsconfig-paths';
import { execSync } from 'node:child_process';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const prefix = process.env.__INTERNAL_PREFIX || '/admin';
if (prefix.endsWith('/')) {
	throw new Error('Prefix must not end with a slash');
}

// Load the version via git tags
const version = execSync('git describe --tags --always').toString().trim();
if (!version) {
	throw new Error('Unable to execute git describe');
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
	},
});
