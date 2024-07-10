import { readdir, readFile } from 'node:fs/promises'
import { platform } from 'node:os'
import { join, resolve } from 'node:path'
import { kill } from 'node:process'

import { Config, CoreV1Api, KubeConfig } from '@kubernetes/client-node'

import log from '~/utils/log'

import { createIntegration } from './integration'

interface Context {
	pid: number | undefined
}

export default createIntegration<Context>({
	name: 'Kubernetes (k8s)',
	context: {
		pid: undefined,
	},
	isAvailable: async ({ pid }) => {
		if (platform() !== 'linux') {
			log.error('INTG', 'Kubernetes is only available on Linux')
			return false
		}

		const svcRoot = Config.SERVICEACCOUNT_ROOT
		try {
			const files = await readdir(svcRoot)
			if (files.length === 0) {
				log.error('INTG', 'Kubernetes service account not found')
				return false
			}

			const mappedFiles = new Set(files.map(file => join(svcRoot, file)))
			const expectedFiles = [
				Config.SERVICEACCOUNT_CA_PATH,
				Config.SERVICEACCOUNT_TOKEN_PATH,
				Config.SERVICEACCOUNT_NAMESPACE_PATH,
			]

			if (!expectedFiles.every(file => mappedFiles.has(file))) {
				log.error('INTG', 'Malformed Kubernetes service account')
				return false
			}
		} catch (error) {
			log.error('INTG', 'Failed to access %s: %s', svcRoot, error)
			return false
		}

		const namespace = await readFile(
			Config.SERVICEACCOUNT_NAMESPACE_PATH,
			'utf8',
		)

		// Some very ugly nesting but it's necessary
		if (process.env.HEADSCALE_INTEGRATION_UNSTRICT === 'true') {
			log.warn('INTG', 'Skipping strict Pod status check')
		} else {
			const pod = process.env.POD_NAME
			if (!pod) {
				log.error('INTG', 'Missing POD_NAME variable')
				return false
			}

			if (pod.trim().length === 0) {
				log.error('INTG', 'Pod name is empty')
				return false
			}

			try {
				const kc = new KubeConfig()
				kc.loadFromCluster()

				const cluster = kc.getCurrentCluster()
				if (!cluster) {
					log.error('INTG', 'Malformed kubeconfig')
					return false
				}

				log.info('INTG', 'Service account connected to %s (%s)',
					cluster.name,
					cluster.server,
				)

				const kCoreV1Api = kc.makeApiClient(CoreV1Api)

				log.info('INTG', 'Checking pod %s in namespace %s (%s)',
					pod,
					namespace,
					kCoreV1Api.basePath,
				)

				const { response, body } = await kCoreV1Api.readNamespacedPod(
					pod,
					namespace,
				)

				if (response.statusCode !== 200) {
					log.error('INTG', 'Failed to read pod info: http %d',
						response.statusCode,
					)
					return false
				}

				const shared = body.spec?.shareProcessNamespace
				if (shared === undefined) {
					log.error(
						'INTG',
						'Pod does not have spec.shareProcessNamespace set',
					)
					return false
				}

				if (!shared) {
					log.error(
						'INTG',
						'Pod has set but disabled spec.shareProcessNamespace',
					)
					return false
				}

				log.info('INTG', 'Pod %s enabled shared processes', pod)
			} catch (error) {
				log.error('INTG', 'Failed to read pod info: %s', error)
				return false
			}
		}

		const dir = resolve('/proc')
		try {
			const subdirs = await readdir(dir)
			const promises = subdirs.map(async (dir) => {
				const pid = Number.parseInt(dir, 10)

				if (Number.isNaN(pid)) {
					return
				}

				const path = join('/proc', dir, 'cmdline')
				try {
					const data = await readFile(path, 'utf8')
					if (data.includes('headscale')) {
						return pid
					}
				} catch {}
			})

			const results = await Promise.allSettled(promises)
			const pids = []

			for (const result of results) {
				if (result.status === 'fulfilled' && result.value) {
					pids.push(result.value)
				}
			}

			if (pids.length > 1) {
				log.error('INTG', 'Found %d Headscale processes: %s',
					pids.length,
					pids.join(', '),
				)
				return false
			}

			if (pids.length === 0) {
				log.error('INTG', 'Could not find Headscale process')
				return false
			}

			pid = pids[0]
			log.info('INTG', 'Found Headscale process with PID: %d', pid)
			return true
		} catch {
			log.error('INTG', 'Failed to read /proc')
			return false
		}
	},

	onAclChange: ({ pid }) => {
		if (!pid) {
			return
		}

		log.info('INTG', 'Sending SIGHUP to Headscale')
		kill(pid, 'SIGHUP')
	},

	onConfigChange: ({ pid }) => {
		if (!pid) {
			return
		}

		log.info('INTG', 'Sending SIGTERM to Headscale')
		kill(pid, 'SIGTERM')
	},
})
