import { access, constants } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'

import { Client } from 'undici'

import { HeadscaleError, pull } from '~/utils/headscale'

import type { Integration } from '.'

// Integration name
const name = 'Docker'

let url: URL | undefined
let container: string | undefined

async function preflight() {
	const path = process.env.DOCKER_SOCK ?? 'unix:///var/run/docker.sock'

	try {
		url = new URL(path)
	} catch {
		return false
	}

	// The API is available as an HTTP endpoint
	if (url.protocol === 'tcp:') {
		url.protocol = 'http:'
	}

	// Check if the socket is accessible
	if (url.protocol === 'unix:') {
		try {
			await access(path, constants.R_OK)
		} catch {
			return false
		}
	}

	if (url.protocol === 'http:') {
		try {
			await fetch(new URL('/v1.30/version', url).href)
		} catch {
			return false
		}
	}

	if (url.protocol !== 'http:' && url.protocol !== 'unix:') {
		return false
	}

	container = process.env.HEADSCALE_CONTAINER
		?.trim()
		.toLowerCase()

	if (!container || container.length === 0) {
		return false
	}

	return true
}

async function sighup() {
	if (!url || !container) {
		return
	}

	// Supports the DOCKER_SOCK environment variable
	const client = url.protocol === 'unix:'
		? new Client('http://localhost', {
			socketPath: url.href,
		})
		: new Client(url.href)

	const response = await client.request({
		method: 'POST',
		path: `/v1.30/containers/${container}/kill?signal=SIGHUP`,
	})

	if (!response.statusCode || response.statusCode !== 204) {
		throw new Error('Failed to send SIGHUP to Headscale')
	}
}

async function restart() {
	if (!url || !container) {
		return
	}

	// Supports the DOCKER_SOCK environment variable
	const client = url.protocol === 'unix:'
		? new Client('http://localhost', {
			socketPath: url.href,
		})
		: new Client(url.href)

	const response = await client.request({
		method: 'POST',
		path: `/v1.30/containers/${container}/restart`,
	})

	if (!response.statusCode || response.statusCode !== 204) {
		throw new Error('Failed to restart Headscale')
	}

	// Wait for Headscale to restart before continuing
	let attempts = 0
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
	while (true) {
		try {
			await pull('v1', '')
			return
		} catch (error) {
			if (error instanceof HeadscaleError && error.status === 401) {
				break
			}

			if (attempts > 10) {
				throw new Error('Headscale did not restart in time')
			}

			attempts++
			await setTimeout(1000)
		}
	}
}

export default { name, preflight, sighup, restart } satisfies Integration
