import { readFile, readdir } from 'node:fs/promises';
import { platform } from 'node:os';
import { join, resolve } from 'node:path';
import { kill } from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { HeadscaleError, healthcheck } from '~/utils/headscale';
import { HeadplaneConfig } from '~server/context/parser';
import log from '~server/utils/log';
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
			log.error('INTG', '/proc is only available on Linux');
			return false;
		}

		log.debug('INTG', 'Checking /proc for Headscale process');
		const dir = resolve('/proc');
		try {
			const subdirs = await readdir(dir);
			const promises = subdirs.map(async (dir) => {
				const pid = Number.parseInt(dir, 10);

				if (Number.isNaN(pid)) {
					return;
				}

				const path = join('/proc', dir, 'cmdline');
				try {
					log.debug('INTG', 'Reading %s', path);
					const data = await readFile(path, 'utf8');
					if (data.includes('headscale')) {
						return pid;
					}
				} catch (error) {
					log.error('INTG', 'Failed to read %s: %s', path, error);
				}
			});

			const results = await Promise.allSettled(promises);
			const pids = [];

			for (const result of results) {
				if (result.status === 'fulfilled' && result.value) {
					pids.push(result.value);
				}
			}

			log.debug('INTG', 'Found Headscale processes: %o', pids);
			if (pids.length > 1) {
				log.error(
					'INTG',
					'Found %d Headscale processes: %s',
					pids.length,
					pids.join(', '),
				);
				return false;
			}

			if (pids.length === 0) {
				log.error('INTG', 'Could not find Headscale process');
				return false;
			}

			this.pid = pids[0];
			log.info('INTG', 'Found Headscale process with PID: %d', this.pid);
			return true;
		} catch {
			log.error('INTG', 'Failed to read /proc');
			return false;
		}
	}

	async onConfigChange() {
		if (!this.pid) {
			return;
		}

		try {
			log.info('INTG', 'Sending SIGTERM to Headscale');
			kill(this.pid, 'SIGTERM');
		} catch (error) {
			log.error('INTG', 'Failed to send SIGTERM to Headscale: %s', error);
			log.debug('INTG', 'kill(1) error: %o', error);
		}

		await setTimeout(1000);
		let attempts = 0;
		while (attempts <= this.maxAttempts) {
			try {
				log.debug('INTG', 'Checking Headscale status (attempt %d)', attempts);
				await healthcheck();
				log.info('INTG', 'Headscale is up and running');
				return;
			} catch (error) {
				if (error instanceof HeadscaleError && error.status === 401) {
					break;
				}

				if (error instanceof HeadscaleError && error.status === 404) {
					break;
				}

				if (attempts < this.maxAttempts) {
					attempts++;
					await setTimeout(1000);
					continue;
				}

				log.error(
					'INTG',
					'Missed restart deadline for Headscale (pid %d)',
					this.pid,
				);
				return;
			}
		}
	}
}
