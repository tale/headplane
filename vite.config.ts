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

export default defineConfig(({ command, isSsrBuild }) => ({
	base: command === 'build' ? `${prefix}/` : undefined,
	plugins: [
		reactRouterHonoServer(),
		reactRouter(),
		tailwindcss(),
		tsconfigPaths(),
	],
	server: {
		host: server.host,
		port: server.port,
		allowedHosts: ['hs-admin.rahatol.com'],
		hmr: {
			host: 'hs-admin.rahatol.com',
			clientPort: 443,
			protocol: 'wss',
			path: '/hmr',
		},
	},
	build: {
		target: 'esnext',
		sourcemap: true,
		rolldownOptions:
			command === 'build'
				? {
						// Exclude libsql from the server side since it's a native module
						// Exclude WASM from the client since it fetches from the server
						external: isSsrBuild ? [/^@libsql\//] : [/\.wasm(\?url)?$/],
						output: {
							manualChunks: undefined,
							inlineDynamicImports: isSsrBuild,
						},
					}
				: undefined,
	},
	ssr: {
		target: 'node',
		noExternal: command === 'build' ? true : undefined,
	},
	optimizeDeps: {
		include: ['@libsql/client'],
	},
	define: {
		__VERSION__: JSON.stringify(isNext ? `${version}-next` : version),
		__PREFIX__: JSON.stringify(prefix),
	},
}));
