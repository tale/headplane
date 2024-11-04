#!/usr/bin/env node

import { access, constants } from 'node:fs/promises'

function log(level, message) {
	const date = new Date().toISOString()
	console.log(`${date} (${level}) [SRVX] ${message}`)
}

log('INFO', `Running with Node.js ${process.versions.node}`)

try {
	await access('./node_modules/@remix-run', constants.F_OK | constants.R_OK)
	log('INFO', 'Found node_modules dependencies')
} catch (error) {
	log('ERROR', 'No node_modules found. Please run `pnpm install` first')
	log('ERROR', error)
	process.exit(1)
}

try {
	await access('./build/server', constants.F_OK | constants.R_OK)
	log('INFO', 'Found build directory')
} catch (error) {
	const date = new Date().toISOString()
	log('ERROR', 'No build directory found. Please run `pnpm build` first')
	log('ERROR', error)
	process.exit(1)
}

const { installGlobals } = await import('@remix-run/node')
const { remix } = await import('remix-hono/handler')
const { serve } = await import('@hono/node-server')
const { Hono } = await import('hono')

installGlobals()
const app = new Hono()
const port = process.env.PORT || 3000
const host = process.env.HOST || '0.0.0.0'

app.use('*', remix({
	build: await import('./build/server/index.js'),
	mode: 'production'
}))

serve({
	fetch: app.fetch,
	hostname: host,
	port
})

log('INFO', `Running on ${host}:${port}`)
