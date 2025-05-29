import { readFile, readdir } from 'node:fs/promises';
import { platform } from 'node:os';
import { join, resolve } from 'node:path';
import { kill } from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { ApiClient } from '~/server/headscale/api-client';
import log from '~/utils/log';
import { HeadplaneConfig } from '../schema';
import { Integration } from './abstract';

type T = NonNullable<HeadplaneConfig['integration']>['proc'];
export default class ProcIntegration extends Integration<T> {
	private pid: number | undefined;
	private maxAttempts = 10;

	get name() {
		return 'Native Linux (/proc)';
	}

	async isAvailable() {
		if (platform() !== 'linux') {
			log.error('config', '/proc is only available on Linux');
			return false;
		}

		log.debug('config', 'Checking /proc for Headscale process');
		const dir = resolve('/proc');
		try {
			const subdirs = await readdir(dir);
			const promises = subdirs.map(async (dir) => {
				const pid = Number.parseInt(dir, 10);

				if (Number.isNaN(pid)) {
					return;
				}

				const path = join('/proc', dir, 'comm');
				try {
					log.debug('config', 'Reading %s', path);
					const data = await readFile(path, 'utf8');
					if (data.trim() !== 'headscale') {
						throw new Error(
							`Found PID with unexpected command: ${data.trim()}`,
						);
					}

					return pid;
				} catch (error) {
					log.error('config', 'Failed to read %s: %s', path, error);
				}
			});

			const results = await Promise.allSettled(promises);
			const pids = [];

			for (const result of results) {
				if (result.status === 'fulfilled' && result.value) {
					pids.push(result.value);
				}
			}

			log.debug('config', 'Found Headscale processes: %o', pids);
			if (pids.length > 1) {
				log.error(
					'config',
					'Found %d Headscale processes: %s',
					pids.length,
					pids.join(', '),
				);
				return false;
			}

			if (pids.length === 0) {
				log.error('config', 'Could not find Headscale process');
				return false;
			}

			this.pid = pids[0];
			log.info('config', 'Found Headscale process with PID: %d', this.pid);
			return true;
		} catch {
			log.error('config', 'Failed to read /proc');
			return false;
		}
	}

	async onConfigChange(client: ApiClient) {
		if (!this.pid) {
			return;
		}

		try {
			log.info('config', 'Sending SIGTERM to Headscale');
			kill(this.pid, 'SIGTERM');
		} catch (error) {
			log.error('config', 'Failed to send SIGTERM to Headscale: %s', error);
			log.debug('config', 'kill(1) error: %o', error);
		}

		await setTimeout(1000);
		let attempts = 0;
		while (attempts <= this.maxAttempts) {
			try {
				log.debug('config', 'Checking Headscale status (attempt %d)', attempts);
				const status = await client.healthcheck();
				if (status === false) {
					log.error('config', 'Headscale is not running');
					return;
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
					'Missed restart deadline for Headscale (pid %d)',
					this.pid,
				);
				return;
			}
		}
	}
}
