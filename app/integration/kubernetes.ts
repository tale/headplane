import { readdir, readFile } from 'node:fs/promises'
import { platform } from 'node:os'
import { join, resolve } from 'node:path'
import { kill } from 'node:process'

import { Config, CoreV1Api, KubeConfig } from '@kubernetes/client-node'

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
			return false
		}

		const svcRoot = Config.SERVICEACCOUNT_ROOT
		try {
			const files = await readdir(svcRoot)
			if (files.length === 0) {
				console.error('No Kubernetes service account found')
				return false
			}

			const mappedFiles = new Set(files.map(file => join(svcRoot, file)))
			const expectedFiles = [
				Config.SERVICEACCOUNT_CA_PATH,
				Config.SERVICEACCOUNT_TOKEN_PATH,
				Config.SERVICEACCOUNT_NAMESPACE_PATH,
			]

			if (!expectedFiles.every(file => mappedFiles.has(file))) {
				console.error('Kubernetes service account is incomplete')
				return false
			}
		} catch (error) {
			console.error('Failed to access Kubernetes service account', error)
			return false
		}

		const namespace = await readFile(
			Config.SERVICEACCOUNT_NAMESPACE_PATH,
			'utf8',
		)

		// Some very ugly nesting but it's necessary
		if (process.env.HEADSCALE_INTEGRATION_UNSTRICT === 'true') {
			console.warn('Skipping strict Kubernetes integration check')
		} else {
			const pod = process.env.POD_NAME
			if (!pod) {
				console.error('No pod name found (POD_NAME)')
				return false
			}

			if (pod.trim().length === 0) {
				console.error('Pod name is empty')
				return false
			}

			try {
				const kc = new KubeConfig()
				kc.loadFromCluster()

				const kCoreV1Api = kc.makeApiClient(CoreV1Api)
				const { response, body } = await kCoreV1Api.readNamespacedPod(
					pod,
					namespace,
				)

				if (response.statusCode !== 200) {
					console.error('Failed to read pod', response.statusCode)
					return false
				}

				const shared = body.spec?.shareProcessNamespace
				if (shared === undefined) {
					console.error('Pod does not have shareProcessNamespace set')
					return false
				}

				if (!shared) {
					console.error('Pod has disabled shareProcessNamespace')
					return false
				}
			} catch (error) {
				console.error('Failed to check pod', error)
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
				console.warn('Found multiple Headscale processes', pids)
				console.log('Disabling the /proc integration')
				return false
			}

			if (pids.length === 0) {
				console.warn('Could not find Headscale process')
				console.log('Disabling the /proc integration')
				return false
			}

			pid = pids[0]
			console.log('Found Headscale process', pid)
			return true
		} catch {
			return false
		}
	},

	onAclChange: ({ pid }) => {
		if (!pid) {
			return
		}

		kill(pid, 'SIGHUP')
	},

	onConfigChange: ({ pid }) => {
		if (!pid) {
			return
		}

		kill(pid, 'SIGTERM')
	},
})
