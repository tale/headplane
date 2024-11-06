import { vitePlugin as remix } from '@remix-run/dev'
import { installGlobals } from '@remix-run/node'
import { defineConfig } from 'vite'
import babel from 'vite-plugin-babel'
import tsconfigPaths from 'vite-tsconfig-paths'

installGlobals()

const prefix = process.env.__INTERNAL_PREFIX || '/admin'
if (prefix.endsWith('/')) {
	throw new Error('Prefix must not end with a slash')
}

export default defineConfig(({ isSsrBuild }) => {
	// If we have the Headplane entry we build it as a single
	// server.mjs file that is built for production server bundle
	// We know the remix invoked command is vite:build
	if (!process.argv.includes('vite:build')) {
		return {
			build: {
				minify: false,
				target: 'esnext',
				rollupOptions: {
					input: './server.mjs',
					output: {
						entryFileNames: 'server.js',
						dir: 'build/headplane',
						banner: '#!/usr/bin/env node\n',
					},
					external: (id) => id.startsWith('node:'),
				}
			},
			define: {
				PREFIX: JSON.stringify(prefix),
			},
			resolve: {
				alias: {
					stream: 'node:stream',
					crypto: 'node:crypto',
				}
			}
		}
	}

	return ({
		base: `${prefix}/`,
		build: isSsrBuild ? { target: 'ES2022' } : {},
		plugins: [
			remix({
				basename: `${prefix}/`,
			}),
			tsconfigPaths(),
			babel({
				filter: /\.[jt]sx?$/,
				babelConfig: {
					presets: ['@babel/preset-typescript'],
					plugins: [
						['babel-plugin-react-compiler', {}],
					],
				},
			}),
		],
	})
})
