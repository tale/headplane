import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';
import tsconfigPaths from 'vite-tsconfig-paths';
import { execSync } from 'node:child_process';

const prefix = process.env.__INTERNAL_PREFIX || '/admin';
if (prefix.endsWith('/')) {
	throw new Error('Prefix must not end with a slash');
}

// Load the version via git tags
const version = execSync('git describe --tags --always').toString().trim();
if (!version) {
	throw new Error('Unable to execute git describe');
}

export default defineConfig(({ isSsrBuild }) => {
	// If we have the Headplane entry we build it as a single
	// server/prod.mjs file that is built for production server bundle
	// We know the remix invoked command is vite:build

	return {
		base: prefix,
		build: isSsrBuild ? { target: 'ES2022' } : {},

		define: {
			__VERSION__: JSON.stringify(version),
		},

		plugins: [
			reactRouter(),
			tsconfigPaths(),
			babel({
				filter: /\.[jt]sx?$/,
				babelConfig: {
					presets: ['@babel/preset-typescript'],
					plugins: [['babel-plugin-react-compiler', {}]],
				},
			}),
		],
	};
});
