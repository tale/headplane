import { readdir, readFile } from 'node:fs/promises'
import { platform } from 'node:os'
import { join, resolve } from 'node:path'
import { kill } from 'node:process'

import { createIntegration } from './integration'

interface Context {
	pid: number | undefined
}

export default createIntegration<Context>({
	name: 'Native Linux (/proc)',
	context: {
		pid: undefined,
	},
	isAvailable: async ({ pid }) => {
		if (platform() !== 'linux') {
			return false
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
})
