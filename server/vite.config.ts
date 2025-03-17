import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { devDependencies } from '../package.json';

const prefix = process.env.__INTERNAL_PREFIX || '/admin';
if (prefix.endsWith('/')) {
	throw new Error('Prefix must not end with a slash');
}

const require = createRequire(import.meta.url);

export default defineConfig({
	define: {
		__hp_prefix: JSON.stringify(prefix),
	},
	resolve: {
		preserveSymlinks: true,
		alias: {
			buffer: 'node:buffer',
			crypto: 'node:crypto',
			events: 'node:events',
			fs: 'node:fs',
			net: 'node:net',
			http: 'node:http',
			https: 'node:https',
			os: 'node:os',
			path: 'node:path',
			stream: 'node:stream',
			tls: 'node:tls',
			url: 'node:url',
			zlib: 'node:zlib',
			ws: require.resolve('ws'),
		},
	},
	plugins: [tsconfigPaths()],
	build: {
		minify: false,
		target: 'esnext',
		lib: {
			entry: 'server/entry.ts',
			formats: ['es'],
		},
		rollupOptions: {
			treeshake: {
				moduleSideEffects: false,
			},
			output: {
				entryFileNames: 'server.js',
				dir: 'build/headplane',
				banner: '#!/usr/bin/env node\n',
			},

			// We are selecting a list of dependencies we want to include
			// We are only including our production dependencies
			external: (id) => {
				if (id.startsWith('node:')) {
					return true;
				}

				const match = id.match(/node_modules\/([^/]+)/);
				if (match) {
					const dep = match[1];
					if ((devDependencies as Record<string, string>)[dep]) {
						return true;
					}
				}
			},
		},
	},
});
