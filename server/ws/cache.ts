import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { type } from 'arktype';
import log from '~server/utils/log';
import mutex from '~server/utils/mutex';

const diskSchema = type({
	key: 'string',
	value: 'unknown',
	expires: 'number?',
}).array();

// A persistent HashMap with a TTL for each key
export class TimedCache<V> {
	private _cache = new Map<string, V>();
	private _timings = new Map<string, number>();

	// Default TTL is 1 minute
	private defaultTTL: number;
	private filePath: string;
	private writeLock = mutex();

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
			log.error('CACH', 'Failed to load cache at %s', this.filePath);
			return;
		}

		const cacheData = diskSchema(diskData);
		if (cacheData instanceof type.errors) {
			log.error('CACH', 'Failed to load cache at %s', this.filePath);
			log.debug('CACHE', 'Error details: %s', cacheData.toString());

			// Skip loading the cache (it should be overwritten soon)
			return;
		}

		for (const { key, value, expires } of diskData) {
			this._cache.set(key, value);
			this._timings.set(key, expires);
		}

		log.info('CACH', 'Loaded cache from %s', this.filePath);
	}

	private async flush() {
		this.writeLock.acquire();
		const data = Array.from(this._cache.entries()).map(([key, value]) => {
			return { key, value, expires: this._timings.get(key) };
		});

		if (data.length === 0) {
			this.writeLock.release();
			return;
		}

		// Calculate the hash of the data
		const dumpData = JSON.stringify(data);
		const sha = createHash('sha256').update(dumpData).digest('hex');
		if (sha === this.lastFlushId) {
			this.writeLock.release();
			return;
		}

		await writeFile(this.filePath, dumpData, 'utf-8');
		this.lastFlushId = sha;
		this.writeLock.release();
		log.debug('CACH', 'Flushed cache to %s', this.filePath);
	}
}
