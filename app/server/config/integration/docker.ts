import { constants, access } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { Client } from 'undici';
import { ApiClient } from '~/server/headscale/api-client';
import log from '~/utils/log';
import type { HeadplaneConfig } from '../schema';
import { Integration } from './abstract';

type T = NonNullable<HeadplaneConfig['integration']>['docker'];
export default class DockerIntegration extends Integration<T> {
	private maxAttempts = 10;
	private client: Client | undefined;

	get name() {
		return 'Docker';
	}

	async isAvailable() {
		if (this.context.container_name.length === 0) {
			log.error('config', 'Docker container name is empty');
			return false;
		}

		log.info('config', 'Using container: %s', this.context.container_name);
		let url: URL | undefined;
		try {
			url = new URL(this.context.socket);
		} catch {
			log.error(
				'config',
				'Invalid Docker socket path: %s',
				this.context.socket,
			);
			return false;
		}

		if (url.protocol !== 'tcp:' && url.protocol !== 'unix:') {
			log.error('config', 'Invalid Docker socket protocol: %s', url.protocol);
			return false;
		}

		// The API is available as an HTTP endpoint and this
		// will simplify the fetching logic in undici
		if (url.protocol === 'tcp:') {
			// Apparently setting url.protocol doesn't work anymore?
			const fetchU = url.href.replace(url.protocol, 'http:');

			try {
				log.info('config', 'Checking API: %s', fetchU);
				await fetch(new URL('/v1.30/version', fetchU).href);
			} catch (error) {
				log.error('config', 'Failed to connect to Docker API: %s', error);
				log.debug('config', 'Connection error: %o', error);
				return false;
			}

			this.client = new Client(fetchU);
		}

		// Check if the socket is accessible
		if (url.protocol === 'unix:') {
			try {
				log.info('config', 'Checking socket: %s', url.pathname);
				await access(url.pathname, constants.R_OK);
			} catch (error) {
				log.error('config', 'Failed to access Docker socket: %s', url.pathname);
				log.debug('config', 'Access error: %o', error);
				return false;
			}

			this.client = new Client('http://localhost', {
				socketPath: url.pathname,
			});
		}

		return this.client !== undefined;
	}

	async onConfigChange(client: ApiClient) {
		if (!this.client) {
			return;
		}

		log.info('config', 'Restarting Headscale via Docker');

		let attempts = 0;
		while (attempts <= this.maxAttempts) {
			log.debug(
				'config',
				'Restarting container: %s (attempt %d)',
				this.context.container_name,
				attempts,
			);

			const response = await this.client.request({
				method: 'POST',
				path: `/v1.30/containers/${this.context.container_name}/restart`,
			});

			if (response.statusCode !== 204) {
				if (attempts < this.maxAttempts) {
					attempts++;
					await setTimeout(1000);
					continue;
				}

				const stringCode = response.statusCode.toString();
				const body = await response.body.text();
				throw new Error(`API request failed: ${stringCode} ${body}`);
			}

			break;
		}

		attempts = 0;
		while (attempts <= this.maxAttempts) {
			try {
				log.debug('config', 'Checking Headscale status (attempt %d)', attempts);
				const status = await client.healthcheck();
				if (status === false) {
					throw new Error('Headscale is not running');
				}

				log.info('config', 'Headscale is up and running');
				return;
			} catch (error) {
				if (attempts < this.maxAttempts) {
					attempts++;
					await setTimeout(1000);
					continue;
				}

				log.error(
					'config',
					'Missed restart deadline for %s',
					this.context.container_name,
				);
				return;
			}
		}
	}
}
