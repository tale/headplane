import { open } from 'node:fs/promises';
import type { HostInfo } from '~/types';
import {
	hp_getSingleton,
	hp_getSingletonUnsafe,
	hp_setSingleton,
} from '~server/context/global';
import log from '~server/utils/log';
import { TimedCache } from './cache';

export async function hp_loadAgentCache(defaultTTL: number, filepath: string) {
	log.debug('CACH', `Loading agent cache from ${filepath}`);

	try {
		const handle = await open(filepath, 'w');
		log.info('CACH', `Using agent cache file at ${filepath}`);
		await handle.close();
	} catch (e) {
		log.info('CACH', `Agent cache file not found at ${filepath}`);
		return;
	}

	const cache = new TimedCache<HostInfo>(defaultTTL, filepath);
	hp_setSingleton('ws_agent_data', cache);
}

export async function hp_agentRequest(nodeList: string[]) {
	// Request to all connected agents (we can have multiple)
	// Luckily we can parse all the data at once through message parsing
	// and then overlapping cache entries will be overwritten by time
	const agents = hp_getSingleton('ws_agents');
	const cache = hp_getSingletonUnsafe('ws_agent_data');

	// Deduplicate the list of nodes
	const NodeIDs = [...new Set(nodeList)];
	NodeIDs.map((node) => {
		log.debug('CACH', 'Requesting agent data for', node);
	});

	// Await so that data loads on first request without racing
	// Since we do agent.once() we NEED to wait for it to finish
	await Promise.allSettled(
		[...agents].map(async ([id, agent]) => {
			agent.send(JSON.stringify({ NodeIDs }));
			await new Promise<void>((resolve) => {
				// Just as a safety measure, we set a maximum timeout of 3 seconds
				setTimeout(() => resolve(), 3000);

				agent.once('message', (data) => {
					const parsed = JSON.parse(data.toString());
					log.debug('CACH', 'Received agent data from %s', id);
					for (const [node, info] of Object.entries<HostInfo>(parsed)) {
						cache?.set(node, info);
						log.debug('CACH', 'Cached %s', node);
					}

					resolve();
				});
			});
		}),
	);
}
