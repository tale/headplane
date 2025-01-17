import { type RequestListener } from 'node:http';
import { resolve, join } from 'node:path'
import { createServer } from 'vite'
import { createRequestHandler } from 'react-router'
import { access, constants } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import {
	createReadableStreamFromReadable,
	writeReadableStreamToWritable,
} from '@react-router/node';
import mime from 'mime/lite'

import { loadDevtools, stacksafeTry } from '~server/dev';
import { appContext } from '~server/ws';
import prodBuild from '~server/prod-handler';

declare global {
	// Prefix is a build-time constant
	const __hp_prefix: string;
}

const devtools = import.meta.env.DEV
	? await loadDevtools()
	: undefined;

const prodHandler = import.meta.env.PROD
	? await prodBuild()
	: undefined;

const buildPath = process.env.BUILD_PATH ?? './build';
const baseDir = resolve(join(buildPath, 'client'));

export const listener: RequestListener = async (req, res) => {
	const url = new URL(`http://${req.headers.host}${req.url}`);

	// build:strip
	if (devtools) {
		await new Promise((resolve) => {
			devtools.server.middlewares(req, res, resolve);
		});
	}

	if (!url.pathname.startsWith(__hp_prefix)) {
		res.writeHead(404);
		res.end();
		return;
	}

	// We need to handle an issue where say we are navigating to $PREFIX
	// but Remix does not handle it without the trailing slash. This is
	// because Remix uses the URL constructor to parse the URL and it
	// will remove the trailing slash. We need to redirect to the correct
	// URL so that Remix can handle it correctly.
	if (url.pathname === __hp_prefix) {
		res.writeHead(301, {
			Location: `${__hp_prefix}/`,
		});
		res.end();
		return;
	}

	// Before we pass any requests to our Remix handler we need to check
	// if we can handle a raw file request. This is important for the
	// Remix loader to work correctly.
	//
	// To optimize this, we send them as readable streams in the node
	// response and we also set headers for aggressive caching.
	if (url.pathname.startsWith(`${__hp_prefix}/assets/`)) {
		const filePath = join(baseDir, url.pathname.slice(__hp_prefix.length));
		const exists = existsSync(filePath);
		const stats = exists ? statSync(filePath) : null;

		if (exists && stats && stats.isFile()) {
			// Build assets are cache-bust friendly so we can cache them heavily
			res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
		}

		// Send the file as a readable stream
		const fileStream = createReadStream(filePath);
		const type = mime.getType(filePath);

		res.writeHead(200, {
			'Content-Type': type || 'application/octet-stream',
		});

		fileStream.pipe(res);
		return;
	}

	// Handling the request
	const controller = new AbortController();
	res.on('close', () => controller.abort());

	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		if (!value) continue;
		if (Array.isArray(value)) {
			for (const v of value) {
				headers.append(key, v);
			}

			continue;
		}

		headers.append(key, value);
	}

	const frameworkReq = new Request(url.href, {
		headers,
		method: req.method,
		signal: controller.signal,

		// If we have a body, we set the duplex and load it
		...(req.method !== 'GET' && req.method !== 'HEAD'
			? {
				body: createReadableStreamFromReadable(req),
				duplex: 'half',
			} : {}),
	});

	const response = devtools
		? await stacksafeTry(devtools, frameworkReq, appContext())
		: await prodHandler(frameworkReq, appContext());

	res.statusCode = response.status;
	res.statusMessage = response.statusText;

	for (const [key, value] of response.headers.entries()) {
		res.appendHeader(key, value);
	}

	if (response.body) {
		await writeReadableStreamToWritable(response.body, res);
	}

	res.end();
}
