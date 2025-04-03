import { readFile, readdir } from 'node:fs/promises';
import { platform } from 'node:os';
import { join, resolve } from 'node:path';
import { kill } from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { Config, CoreV1Api, KubeConfig } from '@kubernetes/client-node';
import { ApiClient } from '~/server/headscale/api-client';
import log from '~/utils/log';
import { HeadplaneConfig } from '../schema';
import { Integration } from './abstract';

// TODO: Upgrade to the new CoreV1Api from @kubernetes/client-node
type T = NonNullable<HeadplaneConfig['integration']>['kubernetes'];
export default class KubernetesIntegration extends Integration<T> {
	private pid: number | undefined;
	private maxAttempts = 10;

	get name() {
		return 'Kubernetes (k8s)';
	}

	async isAvailable() {
		if (platform() !== 'linux') {
			log.error('config', 'Kubernetes is only available on Linux');
			return false;
		}

		const svcRoot = Config.SERVICEACCOUNT_ROOT;
		try {
			log.debug('config', 'Checking Kubernetes service account at %s', svcRoot);
			const files = await readdir(svcRoot);
			if (files.length === 0) {
				log.error('config', 'Kubernetes service account not found');
				return false;
			}

			const mappedFiles = new Set(files.map((file) => join(svcRoot, file)));
			const expectedFiles = [
				Config.SERVICEACCOUNT_CA_PATH,
				Config.SERVICEACCOUNT_TOKEN_PATH,
				Config.SERVICEACCOUNT_NAMESPACE_PATH,
			];

			log.debug('config', 'Looking for %s', expectedFiles.join(', '));
			if (!expectedFiles.every((file) => mappedFiles.has(file))) {
				log.error('config', 'Malformed Kubernetes service account');
				return false;
			}
		} catch (error) {
			log.error('config', 'Failed to access %s: %s', svcRoot, error);
			return false;
		}

		log.debug('config', 'Reading Kubernetes service account at %s', svcRoot);
		const namespace = await readFile(
			Config.SERVICEACCOUNT_NAMESPACE_PATH,
			'utf8',
		);

		// Some very ugly nesting but it's necessary
		if (this.context.validate_manifest === false) {
			log.warn('config', 'Skipping strict Pod status check');
		} else {
			const pod = this.context.pod_name;
			if (!pod) {
				log.error('config', 'Missing POD_NAME variable');
				return false;
			}

			if (pod.trim().length === 0) {
				log.error('config', 'Pod name is empty');
				return false;
			}

			log.debug(
				'config',
				'Checking Kubernetes pod %s in namespace %s',
				pod,
				namespace,
			);

			try {
				log.debug('config', 'Attempgin to get cluster KubeConfig');
				const kc = new KubeConfig();
				kc.loadFromCluster();

				const cluster = kc.getCurrentCluster();
				if (!cluster) {
					log.error('config', 'Malformed kubeconfig');
					return false;
				}

				log.info(
					'config',
					'Service account connected to %s (%s)',
					cluster.name,
					cluster.server,
				);

				const kCoreV1Api = kc.makeApiClient(CoreV1Api);

				log.info(
					'config',
					'Checking pod %s in namespace %s (%s)',
					pod,
					namespace,
					kCoreV1Api.basePath,
				);

				log.debug('config', 'Reading pod info for %s', pod);
				const { response, body } = await kCoreV1Api.readNamespacedPod(
					pod,
					namespace,
				);

				if (response.statusCode !== 200) {
					log.error(
						'config',
						'Failed to read pod info: http %d',
						response.statusCode,
					);
					return false;
				}

				log.debug('config', 'Got pod info: %o', body.spec);
				const shared = body.spec?.shareProcessNamespace;
				if (shared === undefined) {
					log.error(
						'config',
						'Pod does not have spec.shareProcessNamespace set',
					);
					return false;
				}

				if (!shared) {
					log.error(
						'config',
						'Pod has set but disabled spec.shareProcessNamespace',
					);
					return false;
				}

				log.info('config', 'Pod %s enabled shared processes', pod);
			} catch (error) {
				log.error('config', 'Failed to read pod info: %s', error);
				return false;
			}
		}

		log.debug('config', 'Looking for namespaced process in /proc');
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
					log.debug('config', 'Reading %s', path);
					const data = await readFile(path, 'utf8');
					if (data.includes('headscale')) {
						return pid;
					}
				} catch (error) {
					log.debug('config', 'Failed to read %s: %s', path, error);
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
					'Missed restart deadline for Headscale (pid %d)',
					this.pid,
				);
				return;
			}
		}
	}
}
