// This is a polyglot entrypoint for Headplane when running in production
// It doesn't use any dependencies aside from @remix-run/node and mime
// During build we bundle the used dependencies into the file so that
// we can only need this file and a Node.js installation to run the server.
// PREFIX is defined globally, see vite.config.ts

import { access, constants } from 'node:fs/promises'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'
import { env } from 'node:process'

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

const {
	createRequestHandler: remixRequestHandler,
	createReadableStreamFromReadable,
	writeReadableStreamToWritable
} = await import('@remix-run/node')
const { default: mime } = await import('mime')

const port = env.PORT || 3000
const host = env.HOST || '0.0.0.0'
const buildPath = env.BUILD_PATH || './build'

// Because this is a dynamic import without an easily discernable path
// we gain the "deoptimization" we want so that Vite doesn't bundle this
const build = await import(resolve(join(buildPath, 'server', 'index.js')))
const baseDir = resolve(join(buildPath, 'client'))

const handler = remixRequestHandler(build, 'production')
const http = createServer(async (req, res) => {
	const url = new URL(`http://${req.headers.host}${req.url}`)

	if (!url.pathname.startsWith(PREFIX)) {
		res.writeHead(404)
		res.end()
		return
	}

	// We need to handle an issue where say we are navigating to $PREFIX
	// but Remix does not handle it without the trailing slash. This is
	// because Remix uses the URL constructor to parse the URL and it
	// will remove the trailing slash. We need to redirect to the correct
	// URL so that Remix can handle it correctly.
	if (url.pathname === PREFIX) {
		res.writeHead(302, {
			Location: `${PREFIX}/`
		})
		res.end()
		return
	}

	// Before we pass any requests to our Remix handler we need to check
	// if we can handle a raw file request. This is important for the
	// Remix loader to work correctly.
	//
	// To optimize this, we send them as readable streams in the node
	// response and we also set headers for aggressive caching.
	if (url.pathname.startsWith(`${PREFIX}/assets/`)) {
		const filePath = join(baseDir, url.pathname.replace(PREFIX, ''))
		const exists = existsSync(filePath)
		const stats = statSync(filePath)

		if (exists && stats.isFile()) {
			// Build assets are cache-bust friendly so we can cache them heavily
			if (req.url.startsWith('/build')) {
				res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
			}

			// Send the file as a readable stream
			const fileStream = createReadStream(filePath)
			const type = mime.getType(filePath)

			res.setHeader('Content-Length', stats.size)
			res.setHeader('Content-Type', type)
			fileStream.pipe(res)
			return
		}
	}

	// Handling the request
	const controller = new AbortController()
	res.on('close', () => controller.abort())

	const headers = new Headers()
	for (const [key, value] of Object.entries(req.headers)) {
		if (!value) continue

		if (Array.isArray(value)) {
			for (const v of value) {
				headers.append(key, v)
			}

			continue
		}

		headers.append(key, value)
	}

	const remixReq = new Request(url.href, {
		headers,
		method: req.method,
		signal: controller.signal,

		// If we have a body we set a duplex and we load the body
		...(req.method !== 'GET' && req.method !== 'HEAD' ? {
				body: createReadableStreamFromReadable(req),
				duplex: 'half'
			} : {}
		)
	})

	// Pass our request to the Remix handler and get a response
	const response = await handler(remixReq, {}) // No context

	// Handle our response and reply
	res.statusCode = response.status
	res.statusMessage = response.statusText

	for (const [key, value] of response.headers.entries()) {
		res.appendHeader(key, value)
	}

	if (response.body) {
		await writeReadableStreamToWritable(response.body, res)
		return
	}

	res.end()
})

http.listen(port, host, () => {
	log('INFO', `Running on ${host}:${port}`)
})
