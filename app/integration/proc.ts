import { access, constants, readdir, readFile } from 'node:fs/promises'
import { platform } from 'node:os'
import { join, resolve } from 'node:path'
import { kill } from 'node:process'

import type { Integration } from '.'

// Check if we have a /proc and if it's readable
async function preflight() {
	if (platform() !== 'linux') {
		return false
	}

	const dir = resolve('/proc')
	try {
		await access(dir, constants.R_OK)
		return true
	} catch (error) {
		console.error('Failed to access /proc', error)
		return false
	}
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
		if (result.status === 'fulfilled') {
			pids.push(result.value)
		}
	}

	if (pids.length > 1) {
		console.warn('Found multiple Headscale processes', pids)
		console.log('Disabling the /proc integration')
		return
	}

	if (pids.length === 0) {
		console.warn('Could not find Headscale process')
		console.log('Disabling the /proc integration')
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

export default { preflight, sighup } satisfies Integration
