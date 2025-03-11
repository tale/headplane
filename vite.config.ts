import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';
import tsconfigPaths from 'vite-tsconfig-paths';
import fs from 'node:fs';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const prefix = process.env.__INTERNAL_PREFIX || '/admin';
if (prefix.endsWith('/')) {
	throw new Error('Prefix must not end with a slash');
}

const version = fs.readFileSync("version", "utf8");
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
		__PREFIX__: JSON.stringify(prefix),
	},
});
