import { readdir, readFile } from 'node:fs/promises'
import { platform } from 'node:os'
import { join, resolve } from 'node:path'
import { kill } from 'node:process'

import log from '~/utils/log'

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
			log.error('INTG', '/proc is only available on Linux')
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
})
