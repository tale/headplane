// This is a "side-effect" but we want a lifecycle cache map of
// peer statuses to prevent unnecessary fetches to the agent.
import type { LoaderFunctionArgs } from 'remix'

type Context = LoaderFunctionArgs['context']
const cache: { [nodeID: string]: unknown } = {}

export async function queryWS(context: Context, nodeIDs: string[]) {
	const ws = context.ws
	const firstClient = ws.clients.values().next().value
	if (!firstClient) {
		return cache
	}

	const cached = nodeIDs.map((nodeID) => {
		const cached = cache[nodeID]
		if (cached) {
			return cached
		}
	})

	// We only need to query the nodes that are not cached
	const uncached = nodeIDs.filter((nodeID) => !cached.includes(nodeID))
	if (uncached.length === 0) {
		return cache
	}

	firstClient.send(JSON.stringify({ NodeIDs: uncached }))
	await new Promise((resolve) => {
		const timeout = setTimeout(() => {
			resolve()
		}, 3000)

		firstClient.on('message', (message) => {
			const data = JSON.parse(message.toString())
			if (Object.keys(data).length === 0) {
				resolve()
			}

			for (const [nodeID, status] of Object.entries(data)) {
				cache[nodeID] = status
			}
		})
	})

	return cache
}
