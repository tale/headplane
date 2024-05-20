/* eslint-disable no-await-in-loop */
/* eslint-disable no-constant-condition */
import { setTimeout } from 'node:timers/promises'

import { Client } from 'undici'

import { loadContext } from './config/headplane'
import { HeadscaleError, pull } from './headscale'

export async function sighupHeadscale() {
	const context = await loadContext()
	if (!context.docker) {
		return
	}

	const client = new Client('http://localhost', {
		socketPath: context.docker.sock,
	})

	const response = await client.request({
		method: 'POST',
		path: `/v1.30/containers/${context.docker.container}/kill?signal=SIGHUP`,
	})

	if (!response.statusCode || response.statusCode !== 204) {
		throw new Error('Failed to send SIGHUP to Headscale')
	}
}

export async function restartHeadscale() {
	const context = await loadContext()
	if (!context.docker) {
		return
	}

	const client = new Client('http://localhost', {
		socketPath: context.docker.sock,
	})

	const response = await client.request({
		method: 'POST',
		path: `/v1.30/containers/${context.docker.container}/restart`,
	})

	if (!response.statusCode || response.statusCode !== 204) {
		throw new Error('Failed to restart Headscale')
	}

	// Wait for Headscale to restart before continuing
	let attempts = 0
	while (true) {
		try {
			// Acceptable blank because API_KEY is not required
			await pull('v1/apikey', process.env.API_KEY ?? '')
			return
		} catch (error) {
			// This means the server is up but the API key is invalid
			// This can happen if the user only uses API_KEY via cookies
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
