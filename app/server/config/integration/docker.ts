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
	private containerId: string | undefined;

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
		// Basic configuration check, the name overrides the container_label
		// selector because of legacy support.
		const { container_name, container_label } = this.context;
		if (container_name.length === 0 && container_label.length === 0) {
			log.error(
				'config',
				'Missing a Docker `container_name` or `container_label`',
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

		const qp = new URLSearchParams({
			filters: JSON.stringify(
				container_name.length > 0
					? { name: [container_name] }
					: { label: [container_label] },
			),
		});

		log.debug(
			'config',
			'Requesting Docker containers with filters: %s',
			qp.toString(),
		);
		const res = await this.client.request({
			method: 'GET',
			path: `/v1.30/containers/json?${qp.toString()}`,
		});

		if (res.statusCode !== 200) {
			log.error('config', 'Could not request available Docker containers');
			log.debug('config', 'Error Details: %o', await res.body.json());
			return false;
		}

		const data = (await res.body.json()) as DockerContainer[];
		if (data.length > 1) {
			if (container_name.length > 0) {
				log.error(
					'config',
					`Found multiple containers with name ${container_name}`,
				);
			} else {
				log.error(
					'config',
					`Found multiple containers with label ${container_label}`,
				);
			}

			return false;
		}

		if (data.length === 0) {
			if (container_name.length > 0) {
				log.error(
					'config',
					`No container found with the name ${container_name}`,
				);
			} else {
				log.error(
					'config',
					`No container found with the label ${container_label}`,
				);
			}

			return false;
		}

		this.containerId = data[0].Id;
		log.info(
			'config',
			'Using container: %s (ID: %s)',
			data[0].Names[0],
			this.containerId,
		);

		return this.client !== undefined && this.containerId !== undefined;
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
				this.containerId,
				attempts,
			);

			const response = await this.client.request({
				method: 'POST',
				path: `/v1.30/containers/${this.containerId}/restart`,
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

				log.error('config', 'Missed restart deadline for %s', this.containerId);
				return;
			}
		}
	}
}
