// Handlers for the Local Agent on the server side
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as pSetTimeout } from 'node:timers/promises';
import type { LoaderFunctionArgs } from 'react-router';
import { WebSocket } from 'ws';
import type { HostInfo } from '~/types';
import log from './log';

// Essentially a HashMap which invalidates entries after a certain time.
// It also is capable of syncing as a compressed file to disk.
class TimedCache<K, V> {
	private _cache = new Map<K, V>();
	private _timeCache = new Map<K, number>();
	private defaultTTL: number;
	private filepath: string;
	private writeLock = false;

	constructor(defaultTTL: number, filepath: string) {
		this.defaultTTL = defaultTTL;
		this.filepath = filepath;
	}

	async set(key: K, value: V, ttl: number = this.defaultTTL) {
		this._cache.set(key, value);
		this._timeCache.set(key, Date.now() + ttl);
		await this.syncToFile();
	}

	async get(key: K) {
		const entry = this._cache.get(key);
		if (!entry) {
			return;
		}

		const expires = this._timeCache.get(key);
		if (!expires || expires < Date.now()) {
			this._cache.delete(key);
			this._timeCache.delete(key);
			await this.syncToFile();
			return;
		}

		return entry;
	}

	async loadFromFile() {
		try {
			const data = await readFile(this.filepath, 'utf-8');
			const cache = JSON.parse(data);
			for (const { key, value, expires } of cache) {
				this._cache.set(key, value);
				this._timeCache.set(key, expires);
			}
		} catch (e) {
			if (e.code === 'ENOENT') {
				log.debug('CACH', 'Cache file not found, creating new cache');
				return;
			}

			log.error('CACH', 'Failed to load cache from file', e);
		}
	}

	private async syncToFile() {
		while (this.writeLock) {
			await pSetTimeout(100);
		}

		this.writeLock = true;
		const data = Array.from(this._cache.entries()).map(([key, value]) => {
			return { key, value, expires: this._timeCache.get(key) };
		});

		await writeFile(this.filepath, JSON.stringify(data), 'utf-8');
		await this.loadFromFile();
		this.writeLock = false;
	}
}

let cache: TimedCache<string, HostInfo> | undefined;
export async function initAgentCache(defaultTTL: number, filepath: string) {
	cache = new TimedCache(defaultTTL, filepath);
	await pSetTimeout(500);
	await cache.loadFromFile();
}

let agentSocket: WebSocket | undefined;
// TODO: Actually type this?
export function initAgentSocket(context: LoaderFunctionArgs['context']) {
	if (!context.ws) {
		return;
	}

	const client = context.ws.clients.values().next().value;
	agentSocket = client;
}

// Check the cache and then attempt the websocket query
// If we aren't connected to an agent, then debug log and return the cache
export async function queryAgent(nodes: string[]) {
	return;
	// biome-ignore lint: bruh
	if (!cache) {
		log.error('CACH', 'Cache not initialized');
		return;
	}

	const cached: Record<string, HostInfo> = {};
	await Promise.all(
		nodes.map(async (node) => {
			const cachedData = await cache?.get(node);
			if (cachedData) {
				cached[node] = cachedData;
			}
		}),
	);

	const uncached = nodes.filter((node) => !cached[node]);

	// No need to query the agent if we have all the data cached
	if (uncached.length === 0) {
		return cached;
	}

	// We don't have an agent socket, so we can't query the agent
	// and we just return the cached values available instead
	if (!agentSocket) {
		return cached;
	}

	agentSocket?.send(JSON.stringify({ NodeIDs: uncached }));
	// biome-ignore lint: bruh
	const returnData = await new Promise<Record<string, HostInfo> | void>(
		(resolve, reject) => {
			const timeout = setTimeout(() => {
				agentSocket?.removeAllListeners('message');
				resolve();
			}, 3000);

			agentSocket?.on('message', async (message: string) => {
				const data = JSON.parse(message.toString());
				if (Object.keys(data).length === 0) {
					resolve();
				}

				agentSocket?.removeAllListeners('message');
				resolve(data);
			});
		},
	);

	// if (returnData) {
	// 	for await (const [node, info] of Object.entries(returnData)) {
	// 		await cache?.set(node, info);
	// 	}
	// }

	return returnData ? { ...cached, ...returnData } : cached;
}
