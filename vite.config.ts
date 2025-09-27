import { readFile } from 'node:fs/promises';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { reactRouterHonoServer } from 'react-router-hono-server/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { parse } from 'yaml';

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

// Load the config without any environment variables (not needed here)
const config = await readFile('config.example.yaml', 'utf-8');
const { server } = parse(config);

export default defineConfig(({ mode, isSsrBuild }) => ({
	base: mode !== 'development' ? `${prefix}/` : undefined,
	plugins: [
		reactRouterHonoServer(),
		reactRouter(),
		tailwindcss(),
		tsconfigPaths(),
	],
	server: {
		host: server.host,
		port: server.port,
	},
	build: {
		target: 'esnext',
	},
	ssr: {
		target: 'node',
		noExternal: isSsrBuild ? ['@libsql/client'] : undefined,
	},
	optimizeDeps: {
		include: ['@libsql/client'],
	},
	define: {
		__VERSION__: JSON.stringify(isNext ? `${version}-next` : version),
		__PREFIX__: JSON.stringify(prefix),
	},
}));
