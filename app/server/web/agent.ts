import { createHash } from 'node:crypto';
import { open, readFile, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { getConnInfo } from '@hono/node-server/conninfo';
import { type } from 'arktype';
import type { Context } from 'hono';
import type { WSContext, WSEvents } from 'hono/ws';
import { WebSocket } from 'ws';
import { HostInfo } from '~/types';
import log from '~/utils/log';

export async function loadAgentSocket(
	authkey: string,
	path: string,
	ttl: number,
) {
	if (authkey.length === 0) {
		return;
	}

	try {
		const handle = await open(path, 'w');
		log.info('agent', 'Using agent cache file at %s', path);
		await handle.close();
	} catch (error) {
		log.info('agent', 'Agent cache file not accessible at %s', path);
		log.debug('agent', 'Error details: %s', error);
		return;
	}

	const cache = new TimedCache<HostInfo>(ttl, path);
	return new AgentManager(cache, authkey);
}

class AgentManager {
	private cache: TimedCache<HostInfo>;
	private agents: Map<string, WSContext>;
	private timers: Map<string, NodeJS.Timeout>;
	private authkey: string;

	constructor(cache: TimedCache<HostInfo>, authkey: string) {
		this.cache = cache;
		this.authkey = authkey;
		this.agents = new Map();
		this.timers = new Map();
	}

	tailnetIDs() {
		return Array.from(this.agents.keys());
	}

	lookup(nodeIds: string[]) {
		const entries = this.cache.toJSON();
		const missing = nodeIds.filter((nodeId) => !entries[nodeId]);
		if (missing.length > 0) {
			this.requestData(missing);
		}

		return entries;
	}

	// Request data from all connected agents
	// This does not return anything, but caches the data which then needs to be
	// queried by the caller separately.
	private requestData(nodeList: string[]) {
		const NodeIDs = [...new Set(nodeList)];
		NodeIDs.map((node) => {
			log.debug('agent', 'Requesting agent data for %s', node);
		});

		for (const agent of this.agents.values()) {
			agent.send(JSON.stringify({ NodeIDs }));
		}
	}

	// Since we are using Node, Hono is built on 'ws' WebSocket types.
	configureSocket(c: Context): WSEvents<WebSocket> {
		return {
			onOpen: (_, ws) => {
				const id = c.req.header('x-headplane-tailnet-id');
				if (!id) {
					log.warn(
						'agent',
						'Rejecting an agent WebSocket connection without a tailnet ID',
					);
					ws.close(1008, 'ERR_INVALID_TAILNET_ID');
					return;
				}

				const auth = c.req.header('authorization');
				if (auth !== `Bearer ${this.authkey}`) {
					log.warn('agent', 'Rejecting an unauthorized WebSocket connection');

					const info = getConnInfo(c);
					if (info.remote.address) {
						log.warn('agent', 'Agent source IP: %s', info.remote.address);
					}

					ws.close(1008, 'ERR_UNAUTHORIZED');
					return;
				}

				const pinger = setInterval(() => {
					if (ws.readyState !== 1) {
						clearInterval(pinger);
						return;
					}

					ws.raw?.ping();
				}, 30000);

				this.agents.set(id, ws);
				this.timers.set(id, pinger);
			},

			onClose: () => {
				const id = c.req.header('x-headplane-tailnet-id');
				if (!id) {
					return;
				}

				clearInterval(this.timers.get(id));
				this.agents.delete(id);
			},

			onError: (event, ws) => {
				const id = c.req.header('x-headplane-tailnet-id');
				if (!id) {
					return;
				}

				clearInterval(this.timers.get(id));
				if (event instanceof ErrorEvent) {
					log.error('agent', 'WebSocket error: %s', event.message);
				}

				log.debug('agent', 'Closing agent WebSocket connection');
				ws.close(1011, 'ERR_INTERNAL_ERROR');
			},

			// This is where we receive the data from the agent
			// Requests are made in the AgentManager.requestData function
			onMessage: (event, ws) => {
				const id = c.req.header('x-headplane-tailnet-id');
				if (!id) {
					return;
				}

				const data = JSON.parse(event.data.toString());
				log.debug('agent', 'Received agent data from %s', id);
				for (const [node, info] of Object.entries<HostInfo>(data)) {
					this.cache.set(node, info);
					log.debug('agent', 'Cached HostInfo for %s', node);
				}
			},
		};
	}
}

const diskSchema = type({
	key: 'string',
	value: 'unknown',
	expires: 'number?',
}).array();

// A persistent HashMap with a TTL for each key
class TimedCache<V> {
	private _cache = new Map<string, V>();
	private _timings = new Map<string, number>();

	// Default TTL is 1 minute
	private defaultTTL: number;
	private filePath: string;
	private writeLock = false;

	// Last flush ID is essentially a hash of the flush contents
	// Prevents unnecessary flushing if nothing has changed
	private lastFlushId = '';

	constructor(defaultTTL: number, filePath: string) {
		this.defaultTTL = defaultTTL;
		this.filePath = filePath;

		// Load the cache from disk and then queue flushes every 10 seconds
		this.load().then(() => {
			setInterval(() => this.flush(), 10000);
		});
	}

	set(key: string, value: V, ttl: number = this.defaultTTL) {
		this._cache.set(key, value);
		this._timings.set(key, Date.now() + ttl);
	}

	get(key: string) {
		const value = this._cache.get(key);
		if (!value) {
			return;
		}

		const expires = this._timings.get(key);
		if (!expires || expires < Date.now()) {
			this._cache.delete(key);
			this._timings.delete(key);
			return;
		}

		return value;
	}

	// Map into a Record without any TTLs
	toJSON() {
		const result: Record<string, V> = {};
		for (const [key, value] of this._cache.entries()) {
			result[key] = value;
		}

		return result;
	}

	// WARNING: This function expects that this.filePath is NOT ENOENT
	private async load() {
		const data = await readFile(this.filePath, 'utf-8');
		const cache = () => {
			try {
				return JSON.parse(data);
			} catch (e) {
				return undefined;
			}
		};

		const diskData = cache();
		if (diskData === undefined) {
			log.error('agent', 'Failed to load cache at %s', this.filePath);
			return;
		}

		const cacheData = diskSchema(diskData);
		if (cacheData instanceof type.errors) {
			log.debug('agent', 'Failed to load cache at %s', this.filePath);
			log.debug('agent', 'Error details: %s', cacheData.toString());

			// Skip loading the cache (it should be overwritten soon)
			return;
		}

		for (const { key, value, expires } of diskData) {
			this._cache.set(key, value);
			this._timings.set(key, expires);
		}

		log.info('agent', 'Loaded cache from %s', this.filePath);
	}

	private async flush() {
		const data = Array.from(this._cache.entries()).map(([key, value]) => {
			return { key, value, expires: this._timings.get(key) };
		});

		if (data.length === 0) {
			return;
		}

		// Calculate the hash of the data
		const dumpData = JSON.stringify(data);
		const sha = createHash('sha256').update(dumpData).digest('hex');
		if (sha === this.lastFlushId) {
			return;
		}

		// We need to lock the writeLock so that we don't try to write
		// to the file while we're already writing to it
		while (this.writeLock) {
			await setTimeout(100);
		}

		this.writeLock = true;
		await writeFile(this.filePath, dumpData, 'utf-8');
		log.debug('agent', 'Flushed cache to %s', this.filePath);
		this.lastFlushId = sha;
		this.writeLock = false;
	}
}
