import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const prefix = process.env.__INTERNAL_PREFIX || '/admin';
if (prefix.endsWith('/')) {
	throw new Error('Prefix must not end with a slash');
}

export default defineConfig({
	define: {
		__hp_prefix: JSON.stringify(prefix),
	},
	resolve: {
		preserveSymlinks: true,
		alias: {
			stream: 'node:stream',
			crypto: 'node:crypto'
		},
	},
	plugins: [tsconfigPaths()],
	build: {
		minify: false,
		target: 'esnext',
		rollupOptions: {
			input: './server/entry.ts',
			treeshake: {
				moduleSideEffects: false,
			},
			output: {
				entryFileNames: 'server.js',
				dir: 'build/headplane',
				banner: '#!/usr/bin/env node\n',
			},
			// external: (id) => id.startsWith('node:') || id === 'ws',
			external: (id) => {
				// Resolve happens before side-effects are removed
				// ie. vite import because of viteDevServer
				if (/node_modules/.test(id)) {
					return true;
				}

				return id.startsWith('node:')
					|| id === 'ws'
					|| id === 'mime/lite'
					|| id === '@react-router/node';
			}
		},
	}
})
