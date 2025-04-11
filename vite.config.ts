import { readFile } from 'node:fs/promises';
import { reactRouter } from '@react-router/dev/vite';
import autoprefixer from 'autoprefixer';
import { reactRouterHonoServer } from 'react-router-hono-server/dev';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { parse } from 'yaml';

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

// Load the config without any environment variables (not needed here)
const config = await readFile('config.example.yaml', 'utf-8');
const { server } = parse(config);

export default defineConfig(({ isSsrBuild }) => ({
	base: isSsrBuild ? `${prefix}/` : undefined,
	plugins: [reactRouterHonoServer(), reactRouter(), tsconfigPaths()],
	server: {
		host: server.host,
		port: server.port,
	},
	css: {
		postcss: {
			plugins: [tailwindcss, autoprefixer],
		},
	},
	ssr: {
		target: 'node',
		noExternal: isSsrBuild ? true : undefined,
	},
	define: {
		__VERSION__: JSON.stringify(version),
		__PREFIX__: JSON.stringify(prefix),
	},
}));
