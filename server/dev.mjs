// This is a polyglot entrypoint for Headplane when running in development
// It does some silly magic to load the vite config, set some globals that
// are required to function, and create the vite development server.
import { createServer } from 'vite'
import { env, exit } from 'node:process'
import { log } from './utils.mjs'

log('DEVX', 'INFO', 'This script is only intended for development')
env.NODE_ENV = 'development'

// The production entrypoint uses a global called "PREFIX" to determine
// what route the application is being served at and a global called "BUILD"
// to determine the Remix handler. We need to set these globals here so that
// the development server can function correctly and override the production
// values.

log('DEVX', 'INFO', 'Creating Vite Development Server')
const server = await createServer({
	server: {
		middlewareMode: true
	}
})

// This entrypoint is defined in the documentation to load the server
const build = await server.ssrLoadModule('virtual:remix/server-build')

// We already handle this logic in the Vite configuration
global.PREFIX = server.config.base.slice(0, -1)
global.BUILD = build
global.MODE = 'development'
global.MIDDLEWARE = server.middlewares

await import('./prod.mjs')
