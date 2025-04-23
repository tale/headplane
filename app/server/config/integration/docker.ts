import { constants, access } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { Client } from 'undici';
import { ApiClient } from '~/server/headscale/api-client';
import log from '~/utils/log';
import type { HeadplaneConfig } from '../schema';
import { Integration } from './abstract';

interface DockerContainer {
	Id: string;
	Names: string[];
}

type T = NonNullable<HeadplaneConfig['integration']>['docker'];
export default class DockerIntegration extends Integration<T> {
	private maxAttempts = 10;
	private client: Client | undefined;

	get name() {
		return 'Docker';
	}

	async getContainerName(label: string, value: string): Promise<string> {
		if (!this.client) {
			throw new Error('Docker client is not initialized');
		}

		const filters = encodeURIComponent(
			JSON.stringify({
				label: [`${label}=${value}`],
			}),
		);
		const { body } = await this.client.request({
			method: 'GET',
			path: `/containers/json?filters=${filters}`,
		});
		const containers: DockerContainer[] =
			(await body.json()) as DockerContainer[];
		if (containers.length > 1) {
			throw new Error(
				`Found multiple Docker containers matching label ${label}=${value}. Please specify a container name.`,
			);
		}
		if (containers.length === 0) {
			throw new Error(
				`No Docker containers found matching label: ${label}=${value}`,
			);
		}
		log.info(
			'config',
			'Found Docker container matching label: %s=%s',
			label,
			value,
		);
		return containers[0].Id;
	}

	async isAvailable() {
		// Perform a basic check to see if any of the required properties are set
		if (
			this.context.container_name.length === 0 &&
			!this.context.container_label
		) {
			log.error('config', 'Docker container name and label are both empty');
			return false;
		}

		if (
			this.context.container_name.length > 0 &&
			!this.context.container_label
		) {
			log.error(
				'config',
				'Docker container name and label are mutually exclusive',
			);
			return false;
		}

		// Verify that Docker socket is reachable
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
		if (this.client === undefined) {
			log.error('config', 'Failed to create Docker client');
			return false;
		}

		if (this.context.container_name.length === 0) {
			try {
				if (this.context.container_label === undefined) {
					log.error('config', 'Docker container label is not defined');
					return false;
				}
				const containerName = await this.getContainerName(
					this.context.container_label.name,
					this.context.container_label.value,
				);
				if (containerName.length === 0) {
					log.error(
						'config',
						'No Docker containers found matching label: %s=%s',
						this.context.container_label.name,
						this.context.container_label.value,
					);
					return false;
				}
				this.context.container_name = containerName;
			} catch (error) {
				log.error('config', 'Failed to get Docker container name: %s', error);
				return false;
			}
		}

		log.info('config', 'Using container: %s', this.context.container_name);

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
