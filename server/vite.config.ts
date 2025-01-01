import { defineConfig } from 'vite';

const prefix = process.env.__INTERNAL_PREFIX || '/admin';
if (prefix.endsWith('/')) {
	throw new Error('Prefix must not end with a slash');
}

export default defineConfig(() => {
	return {
		build: {
			minify: false,
			target: 'esnext',
			rollupOptions: {
				input: './server/prod.mjs',
				output: {
					entryFileNames: 'server.js',
					dir: 'build/headplane',
					banner: '#!/usr/bin/env node\n',
				},
				external: (id) => id.startsWith('node:') || id === 'ws',
			},
		},
		define: {
			PREFIX: JSON.stringify(prefix),
		},
		resolve: {
			alias: {
				stream: 'node:stream',
				crypto: 'node:crypto',
			},
		},
	};
});
