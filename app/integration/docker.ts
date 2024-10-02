import { access, constants } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'

import { Client } from 'undici'

import { HeadscaleError, pull } from '~/utils/headscale'
import log from '~/utils/log'

import { createIntegration } from './integration'

interface Context {
	client: Client | undefined
	container: string | undefined
	maxAttempts: number
}

export default createIntegration<Context>({
	name: 'Docker',
	context: {
		client: undefined,
		container: undefined,
		maxAttempts: 10,
	},
	isAvailable: async (context) => {
		// Check for the HEADSCALE_CONTAINER environment variable first
		// to avoid unnecessary fetching of the Docker socket
		context.container = process.env.HEADSCALE_CONTAINER
			?.trim()
			.toLowerCase()

		if (!context.container || context.container.length === 0) {
			log.error('INTG', 'Missing HEADSCALE_CONTAINER variable')
			return false
		}

		log.info('INTG', 'Using container: %s', context.container)
		const path = process.env.DOCKER_SOCK ?? 'unix:///var/run/docker.sock'
		let url: URL | undefined

		try {
			url = new URL(path)
		} catch {
			log.error('INTG', 'Invalid Docker socket path: %s', path)
			return false
		}

		if (url.protocol !== 'tcp:' && url.protocol !== 'unix:') {
			log.error('INTG', 'Invalid Docker socket protocol: %s',
				url.protocol,
			)
			return false
		}

		// The API is available as an HTTP endpoint and this
		// will simplify the fetching logic in undici
		if (url.protocol === 'tcp:') {
			// Apparently setting url.protocol doesn't work anymore?
			const fetchU = url.href.replace(url.protocol, 'http:')

			try {
				log.info('INTG', 'Checking API: %s', fetchU)
				await fetch(new URL('/v1.30/version', fetchU).href)
			} catch (error) {
				log.debug('INTG', 'Failed to connect to Docker API', error)
				log.error('INTG', 'Failed to connect to Docker API')
				return false
			}

			context.client = new Client(url.href)
		}

		// Check if the socket is accessible
		if (url.protocol === 'unix:') {
			try {
				log.info('INTG', 'Checking socket: %s',
					url.pathname,
				)
				await access(url.pathname, constants.R_OK)
			} catch {
				log.error('INTG', 'Failed to access Docker socket: %s',
					path,
				)
				return false
			}

			context.client = new Client('http://localhost', {
				socketPath: url.pathname,
			})
		}

		return context.client !== undefined
	},

	onConfigChange: async (context) => {
		if (!context.client || !context.container) {
			return
		}

		log.info('INTG', 'Restarting Headscale via Docker')

		let attempts = 0
		while (attempts <= context.maxAttempts) {
			const response = await context.client.request({
				method: 'POST',
				path: `/v1.30/containers/${context.container}/restart`,
			})

			if (response.statusCode !== 204) {
				if (attempts < context.maxAttempts) {
					attempts++
					await setTimeout(1000)
					continue
				}

				const stringCode = response.statusCode.toString()
				const body = await response.body.text()
				throw new Error(`API request failed: ${stringCode} ${body}`)
			}

			break
		}

		attempts = 0
		while (attempts <= context.maxAttempts) {
			try {
				await pull('v1', '')
				return
			} catch (error) {
				if (error instanceof HeadscaleError && error.status === 401) {
					break
				}

				if (error instanceof HeadscaleError && error.status === 404) {
					break
				}

				if (attempts < context.maxAttempts) {
					attempts++
					await setTimeout(1000)
					continue
				}

				throw new Error(`Missed restart deadline for ${context.container}`)
			}
		}
	},
})
