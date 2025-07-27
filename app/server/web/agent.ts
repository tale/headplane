import { ChildProcess, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	constants,
	access,
	mkdir,
	open,
	readFile,
	writeFile,
} from 'node:fs/promises';
import { exit, geteuid, getegid } from 'node:process';
import { createInterface } from 'node:readline';
import { setTimeout } from 'node:timers/promises';
import { type } from 'arktype';
import { HostInfo } from '~/types';
import log from '~/utils/log';
import type { HeadplaneConfig } from '../config/schema';

interface LogResponse {
	Level: 'info' | 'debug' | 'error' | 'fatal';
	Message: string;
}

interface RegisterMessage {
	Type: 'register';
	ID: string;
}

interface StatusMessage {
	Type: 'status';
	Data: Record<string, HostInfo>;
}

interface MessageResponse {
	Level: 'msg';
	Message: RegisterMessage | StatusMessage;
}

type AgentResponse = LogResponse | MessageResponse;

export async function loadAgentSocket(
	config: NonNullable<HeadplaneConfig['integration']>['agent'] | undefined,
	headscaleUrl: string,
) {
	if (!config?.enabled) {
		return;
	}

	if (config.pre_authkey.trim().length === 0) {
		log.error('agent', 'Agent `pre_authkey` is not set');
		log.warn('agent', 'The agent will not run until resolved');
		return;
	}

	try {
		await access(config.work_dir, constants.R_OK | constants.W_OK);
		log.debug('config', 'Using agent work dir at %s', config.work_dir);
	} catch (error) {
		// Try to create the directory just in case
		try {
			await mkdir(config.work_dir, { recursive: true });
			log.debug('config', 'Created agent work dir at %s', config.work_dir);
			log.info(
				'config',
				'Created missing agent work dir at %s',
				config.work_dir,
			);

			return;
		} catch (innerError) {
			log.error(
				'config',
				'Failed to create agent work dir at %s',
				config.work_dir,
			);
			log.info(
				'config',
				'Agent work dir not accessible at %s',
				config.work_dir,
			);
			log.debug('config', 'Error details: %s', error);
			log.debug('config', 'Create error details: %s', innerError);
			return;
		}
	}

	try {
		const handle = await open(config.cache_path, 'a+');
		log.info('agent', 'Using agent cache file at %s', config.cache_path);
		await handle.close();
	} catch (error) {
		log.info(
			'agent',
			'Agent cache file not accessible at %s',
			config.cache_path,
		);
		log.debug('agent', 'Error details: %s', error);
		return;
	}

	const cache = new TimedCache<HostInfo>(config.cache_ttl, config.cache_path);
	return new AgentManager(cache, config, headscaleUrl);
}

class AgentManager {
	private static readonly MAX_RESTARTS = 5;
	private restartCounter = 0;

	private cache: TimedCache<HostInfo>;
	private headscaleUrl: string;
	private config: NonNullable<
		NonNullable<HeadplaneConfig['integration']>['agent']
	>;

	private spawnProcess: ChildProcess | null;
	private agentId: string | null;
	private uid: number | null;
	private gid: number | null;

	constructor(
		cache: TimedCache<HostInfo>,
		config: NonNullable<NonNullable<HeadplaneConfig['integration']>['agent']>,
		headscaleUrl: string,
	) {
		this.cache = cache;
		this.config = config;
		this.headscaleUrl = headscaleUrl;
		this.spawnProcess = null;
		this.agentId = null;
		this.startAgent();
		this.uid = geteuid ? geteuid() : null;
		this.gid = getegid ? getegid() : null;

		process.on('SIGINT', () => {
			this.spawnProcess?.kill();
			exit(0);
		});

		process.on('SIGTERM', () => {
			this.spawnProcess?.kill();
			exit(0);
		});
	}

	/**
	 * Used by the UI to indicate why the agent is not running.
	 * Exhaustion requires a manual restart of the agent.
	 * (Which can be invoked via the UI)
	 * @returns true if the agent is exhausted
	 */
	exhausted() {
		return this.restartCounter >= AgentManager.MAX_RESTARTS;
	}

	/*
	 * Called by the UI to manually force a restart of the agent.
	 */
	deExhaust() {
		this.restartCounter = 0;
		this.startAgent();
	}

	/*
	 * Stored agent ID for the current process. This is caught by the agent
	 * when parsing the stdout on agent startup.
	 */
	agentID() {
		return this.agentId;
	}

	private startAgent() {
		if (this.spawnProcess) {
			log.debug('agent', 'Agent already running');
			return;
		}

		if (this.exhausted()) {
			log.error('agent', 'Agent is exhausted, cannot start');
			return;
		}

		// Cannot be detached since we want to follow our process lifecycle
		// We also need to be able to send data to the process by using stdin
		log.info(
			'agent',
			'Starting agent process (attempt %d)',
			this.restartCounter,
		);
		this.spawnProcess = spawn(this.config.executable_path, [], {
			...(this.uid ? { uid: this.uid } : {}),
			...(this.gid ? { gid: this.gid } : {}),
			detached: false,
			stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'],
			env: {
				HOME: process.env.HOME,
				HEADPLANE_EMBEDDED: 'true',
				HEADPLANE_AGENT_WORK_DIR: this.config.work_dir,
				HEADPLANE_AGENT_DEBUG: log.debugEnabled ? 'true' : 'false',
				HEADPLANE_AGENT_HOSTNAME: this.config.host_name,
				HEADPLANE_AGENT_TS_SERVER: this.headscaleUrl,
				HEADPLANE_AGENT_TS_AUTHKEY: this.config.pre_authkey,
			},
		});

		if (!this.spawnProcess?.pid) {
			log.error('agent', 'Failed to start agent process');
			this.restartCounter++;
			global.setTimeout(() => this.startAgent(), 1000);
			return;
		}

		if (this.spawnProcess.stdin === null || this.spawnProcess.stdout === null) {
			log.error('agent', 'Failed to connect to agent process');
			this.restartCounter++;
			global.setTimeout(() => this.startAgent(), 1000);
			return;
		}

		const rlStdout = createInterface({
			input: this.spawnProcess.stdout,
			crlfDelay: Number.POSITIVE_INFINITY,
		});

		rlStdout.on('line', (line) => {
			try {
				const parsed = JSON.parse(line) as AgentResponse;
				if (parsed.Level === 'msg') {
					switch (parsed.Message.Type) {
						case 'register':
							this.agentId = parsed.Message.ID;
							break;
						case 'status':
							for (const [key, value] of Object.entries(parsed.Message.Data)) {
								// Mark the agent as the one that is running
								// We store it in the cache so that it shows
								// itself later
								if (key === this.agentId) {
									value.HeadplaneAgent = true;
								}

								this.cache.set(key, value);
							}

							break;
					}

					return;
				}

				switch (parsed.Level) {
					case 'info':
					case 'debug':
					case 'error':
						log[parsed.Level]('agent', parsed.Message);
						break;
					case 'fatal':
						log.error('agent', parsed.Message);
						break;
					default:
						log.debug('agent', 'Unknown agent response: %s', line);
						break;
				}
			} catch (error) {
				log.debug('agent', 'Failed to parse agent response: %s', error);
				log.debug('agent', 'Raw data: %s', line);
			}
		});

		this.spawnProcess.on('error', (error) => {
			log.error('agent', 'Failed to start agent process: %s', error);
			this.restartCounter++;
			this.spawnProcess = null;
			global.setTimeout(() => this.startAgent(), 1000);
		});

		this.spawnProcess.on('exit', (code) => {
			log.error('agent', 'Agent process exited with code %d', code ?? -1);
			this.restartCounter++;
			this.spawnProcess = null;
			global.setTimeout(() => this.startAgent(), 1000);
		});
	}

	async lookup(nodeIds: string[]) {
		const entries = this.cache.toJSON();
		const missing = nodeIds.filter((nodeId) => !entries[nodeId]);
		if (missing.length > 0) {
			await this.requestData(missing);
		}

		return Object.entries(entries).reduce<Record<string, HostInfo>>(
			(acc, [key, value]) => {
				if (nodeIds.includes(key)) {
					acc[key] = value;
				}

				return acc;
			},
			{},
		);
	}

	// Request data from the internal agent by sending a message to the process
	// via stdin. This is a blocking call, so it will wait for the agent to
	// respond before returning.
	private async requestData(nodeList: string[]) {
		if (this.exhausted()) {
			return;
		}

		// Wait for the process to be spawned, busy waiting is gross
		while (this.spawnProcess === null) {
			await setTimeout(100);
		}

		// Send the request to the agent, without waiting for a response.
		// The live data invalidator will re-request the data if it is not
		// available in the cache anyways.
		const data = JSON.stringify({ NodeIDs: nodeList });
		this.spawnProcess.stdin?.write(`${data}\n`);
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
