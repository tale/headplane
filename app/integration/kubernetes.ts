import { access, constants, readdir, readFile } from 'node:fs/promises'
import { platform } from 'node:os'
import { join, resolve } from 'node:path'
import { kill } from 'node:process'

import { AppsV1Api, Config, CoreV1Api, KubeConfig } from '@kubernetes/client-node'

import type { Integration } from '.'

// Integration name
const name = 'Kubernetes (k8s)'

// Check if we have a proper service account and /proc
// This is because the Kubernetes integration is basically
// the /proc integration plus some extra steps.
async function preflight() {
	if (platform() !== 'linux') {
		console.error('Not running on k8s Linux')
		return false
	}

	const dir = resolve('/proc')
	try {
		await access(dir, constants.R_OK)
	} catch (error) {
		console.error('Failed to access /proc', error)
		return false
	}

	const secretsDir = resolve(Config.SERVICEACCOUNT_ROOT)
	try {
		const files = await readdir(secretsDir)
		if (files.length === 0) {
			console.error('No Kubernetes service account found')
			return false
		}

		const mappedFiles = new Set(files.map(file => join(secretsDir, file)))
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

	const namespace = await readFile(Config.SERVICEACCOUNT_NAMESPACE_PATH, 'utf8')
	if (namespace.trim().length === 0) {
		console.error('Kubernetes namespace is empty')
		return false
	}

	// Some very ugly nesting but it's necessary
	const deployment = process.env.DEPLOYMENT_NAME
	if (deployment) {
		const result = await checkDeployment(deployment, namespace)
		if (!result) {
			return false
		}
	} else {
		const pod = process.env.POD_NAME
		if (pod) {
			const result = await checkPod(pod, namespace)
			if (!result) {
				return false
			}
		} else {
			console.error('No deployment or pod name found')
			return false
		}
	}

	return true
}

async function checkPod(pod: string, namespace: string) {
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

	return true
}

async function checkDeployment(deployment: string, namespace: string) {
	if (deployment.trim().length === 0) {
		console.error('Deployment name is empty')
		return false
	}

	try {
		const kc = new KubeConfig()
		kc.loadFromCluster()

		const kAppsV1Api = kc.makeApiClient(AppsV1Api)
		const { response, body } = await kAppsV1Api.readNamespacedDeployment(
			deployment,
			namespace,
		)

		if (response.statusCode !== 200) {
			console.error('Failed to read deployment', response.statusCode)
			return false
		}

		const shared = body.spec?.template.spec?.shareProcessNamespace
		if (shared === undefined) {
			console.error('Deployment does not have shareProcessNamespace set')
			return false
		}

		if (!shared) {
			console.error('Deployment has disabled shareProcessNamespace')
			return false
		}
	} catch (error) {
		console.error('Failed to check deployment', error)
		return false
	}

	return true
}

async function findPid() {
	const dirs = await readdir('/proc')

	const promises = dirs.map(async (dir) => {
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
		console.log('Disabling the k8s integration')
		return
	}

	if (pids.length === 0) {
		console.warn('Could not find Headscale process')
		console.log('Disabling the k8s integration')
		return
	}

	return pids[0]
}

async function sighup() {
	const pid = await findPid()
	if (!pid) {
		return
	}

	try {
		kill(pid, 'SIGHUP')
	} catch (error) {
		console.error('Failed to send SIGHUP to Headscale', error)
	}
}

async function restart() {
	const pid = await findPid()
	if (!pid) {
		return
	}

	try {
		kill(pid, 'SIGTERM')
	} catch (error) {
		console.error('Failed to send SIGTERM to Headscale', error)
	}
}

export default { name, preflight, sighup, restart } satisfies Integration
