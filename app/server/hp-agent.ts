import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import EventEmitter from 'node:events';
import { access, constants, mkdir, open } from 'node:fs/promises';
import { getegid, geteuid } from 'node:process';
import { createInterface, Interface } from 'node:readline';
import { inArray } from 'drizzle-orm';
import { LibSQLDatabase } from 'drizzle-orm/libsql/driver-core';
import { HostInfo } from '~/types';
import log from '~/utils/log';
import { HeadplaneConfig } from './config/config-schema';
import { hostInfo } from './db/schema';

export async function createHeadplaneAgent(
	config: NonNullable<HeadplaneConfig['integration']>['agent'] | undefined,
	headscaleUrl: string,
	db: LibSQLDatabase,
) {
	if (!config?.enabled) {
		return;
	}

	if (!config.pre_authkey) {
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

	const agent = new HeadplaneAgent({
		...config,
		headscaleUrl,
	});

	agent.on('spawn', () => {
		log.info('agent', 'Headplane agent started');
	});

	agent.on('ready', () => {
		log.info('agent', 'Headplane agent is ready and serving queries');
	});

	agent.on('error', (err) => {
		log.warn('agent', 'Headplane agent experienced an error: %s', err.message);
		log.debug('agent', 'Error details: %o', err);
	});

	agent.on('exit', ({ code, signal }) => {
		log.warn(
			'agent',
			'Headplane agent exited with code %s and signal %s',
			code,
			signal,
		);
	});

	agent.on('restart', ({ delay, attempt }) => {
		log.warn(
			'agent',
			'Headplane agent will restart in %f seconds (attempt %d)',
			delay / 1000,
			attempt,
		);
	});

	agent.on('stderr', (data) => {
		log.error('agent', 'Headplane agent stderr:', data);
	});

	agent.on('info', async ({ id, info }) => {
		log.debug('agent', 'Received HostInfo for %s', id);
		try {
			const parsedInfo = JSON.parse(info) as HostInfo;
			await db
				.insert(hostInfo)
				.values({
					host_id: id,
					payload: parsedInfo,
					updated_at: new Date(),
				})
				.onConflictDoUpdate({
					target: hostInfo.host_id,
					set: {
						payload: parsedInfo,
						updated_at: new Date(),
					},
				});
		} catch (error) {
			log.error(
				'agent',
				'Failed to parse HostInfo for %s: %s',
				id,
				error instanceof Error ? error.message : String(error),
			);
			return;
		}
	});

	agent.start();

	process.on('SIGTERM', () => agent.shutdown());
	process.on('SIGINT', () => agent.shutdown());

	return {
		agentID: () => agent.agentID(),
		lookup: async (nodes: string[]) => {
			const results = await db
				.select()
				.from(hostInfo)
				.where(inArray(hostInfo.host_id, nodes));

			return Object.fromEntries(
				results.filter((r) => r.payload).map((r) => [r.host_id, r.payload]),
			) as Record<string, HostInfo>;
		},
	};
}

type AgentOptions = NonNullable<
	NonNullable<HeadplaneConfig['integration']>['agent']
> & {
	headscaleUrl: string;
};

interface AgentEvents {
	ready: [];
	spawn: [];
	error: [Error];
	exit: [{ code?: number; signal?: NodeJS.Signals }];
	restart: [{ delay: number; attempt: number }];
	stderr: [string];
	info: [{ id: string; info: string }];
}

/**
 * A custom class that turns the lifecycle of the agent into an event emitter.
 * It has many different responsibilities ensuring that:
 * - The agent is spawned with the correct configuration
 * - The agent is ready and still running (ping/heartbeat)
 * - The agent is restarted on a backoff strategy
 */
class HeadplaneAgent extends EventEmitter<AgentEvents> {
	private child?: ChildProcessWithoutNullStreams;
	private readline?: Interface;

	private options: AgentOptions;

	private hbInterval?: NodeJS.Timeout;
	private hbDeadline?: NodeJS.Timeout;
	private restartTimer?: NodeJS.Timeout;
	private isWaitingForAck = false;
	private isShuttingDown = false;
	private backoffAttempt = 0;
	private agentId?: string;

	private BASE_BACKOFF_MS = 1.5 * 1000; // 1.5 seconds
	private MAX_BACKOFF_MS = 30 * 1000; // 30 seconds
	private PROBE_COOLDOWN_MS = 5 * 60_000; // 5 minutes
	private PROBE_ATTEMPT_INTERVAL = 10; // Every 10th attempt

	private HEARTBEAT_INTERVAL_MS = 5 * 1000; // 5 seconds
	private HEARTBEAT_TIMEOUT_MS = 3 * 1000; // 3 seconds

	constructor(options: AgentOptions) {
		super();
		this.options = options;
	}

	agentID() {
		return this.agentId;
	}

	start() {
		this.isShuttingDown = false;
		this.spawnInternalChild();
	}

	shutdown() {
		this.isShuttingDown = true;
		this.agentId = undefined;

		clearTimeout(this.restartTimer);
		clearInterval(this.hbInterval);
		clearTimeout(this.hbDeadline);
		this.isWaitingForAck = false;

		this.send('SHUTDOWN');
		this.child?.kill('SIGTERM');
		this.readline?.close();
	}

	private spawnInternalChild() {
		this.child = spawn(this.options.executable_path, {
			stdio: ['pipe', 'pipe', 'pipe'],
			uid: geteuid?.() ?? undefined,
			gid: getegid?.() ?? undefined,
			env: {
				HOME: process.env.HOME,
				HEADPLANE_AGENT_WORK_DIR: this.options.work_dir,
				HEADPLANE_AGENT_DEBUG: log.debugEnabled ? 'true' : 'false',
				HEADPLANE_AGENT_HOSTNAME: this.options.host_name,
				HEADPLANE_AGENT_TS_SERVER: this.options.headscaleUrl,
				HEADPLANE_AGENT_TS_AUTHKEY: this.options.pre_authkey,
			},
		});

		this.emit('spawn');
		this.child.on('error', (err) => this.emit('error', err));
		this.child.stderr.on('data', (data) =>
			this.emit('stderr', data.toString()),
		);

		this.child.on('exit', (code, signal) => {
			this.agentId = undefined;
			this.emit('exit', {
				code: code ?? undefined,
				signal: signal ?? undefined,
			});

			this.readline?.close();
			clearInterval(this.hbInterval);
			clearTimeout(this.hbDeadline);
			this.isWaitingForAck = false;

			if (this.isShuttingDown) {
				log.info('agent', 'Child process exited gracefully');
				return;
			}

			this.backoffAttempt++;
			const delay = this.calculateBackoff();
			this.emit('restart', { delay, attempt: this.backoffAttempt });
			this.restartTimer = setTimeout(() => this.spawnInternalChild(), delay);
		});

		this.readline = createInterface({ input: this.child.stdout });
		this.readline.on('line', (line) => this.readlineHandler(line));
		this.send('START');

		// Start the heartbeat loop with our custom interval
		this.hbInterval = setInterval(() => {
			if (!this.child || this.child.killed) return;

			// If we get here, we missed the last PONG response and can die
			if (this.isWaitingForAck) {
				this.agentId = undefined;
				this.emit('error', new Error('Agent heartbeat missed'));
				this.child.kill('SIGTERM');
				return;
			}

			this.isWaitingForAck = true;
			this.send('PING');

			clearTimeout(this.hbDeadline);
			this.hbDeadline = setTimeout(() => {
				if (this.isWaitingForAck) {
					this.agentId = undefined;
					this.emit('error', new Error('Agent heartbeat timeout'));
					this.child?.kill('SIGTERM');
				}
			}, this.HEARTBEAT_TIMEOUT_MS);
		}, this.HEARTBEAT_INTERVAL_MS);
	}

	private send(s: string) {
		if (!this.child || this.child.killed) return;
		const ok = this.child.stdin.write(`${s}\n`);
		if (!ok) this.child.stdin.once('drain', () => {});
	}

	/**
	 * Calculates a backoff time based on the current attempt.
	 * Supports a randomized jitter to avoid thundering herd problems.
	 *
	 * @param min The minimum backoff time in milliseconds.
	 * @param max The maximum backoff time in milliseconds.
	 * @returns The calculated backoff time in milliseconds.
	 */
	private calculateBackoff() {
		const attempt = this.backoffAttempt;
		if (attempt > 0 && attempt % this.PROBE_ATTEMPT_INTERVAL === 0) {
			const jitter = Math.floor(Math.random() * (this.MAX_BACKOFF_MS + 1));
			const sign = Math.random() < 0.5 ? -1 : 1;

			return Math.max(0, this.PROBE_COOLDOWN_MS + jitter * sign);
		}

		const cap = Math.min(
			this.MAX_BACKOFF_MS,
			this.BASE_BACKOFF_MS * 2 ** attempt,
		);

		return Math.floor(Math.random() * (cap + 1));
	}

	/**
	 * Processes and dispatches the appropriate response based on the message.
	 * @param line The message to process (piped straight from readline)
	 */
	private readlineHandler(line: string) {
		// When we are ready we force a refresh so that the UI has the most
		// up-to-date information and will gracefully handle new info being sent
		if (line.startsWith('READY')) {
			this.backoffAttempt = 0;
			this.send('REFRESH');
			this.emit('ready');

			const agentId = line.slice(5).trim();
			if (this.agentId && this.agentId !== agentId) {
				log.warn(
					'agent',
					'Agent ID changed from %s to %s',
					this.agentId,
					agentId,
				);
			}

			this.agentId = agentId;
			return;
		}

		if (line.startsWith('PONG')) {
			this.isWaitingForAck = false;
			clearTimeout(this.hbDeadline);

			const agentId = line.slice(5).trim();
			if (this.agentId && this.agentId !== agentId) {
				log.warn(
					'agent',
					'Agent ID changed from %s to %s',
					this.agentId,
					agentId,
				);
			}

			this.agentId = agentId;
			return;
		}

		if (line.startsWith('HOSTINFO')) {
			const data = line.slice(9).trim();
			const [id, ...infoParts] = data.split(' ');
			const info = infoParts.join(' ');
			this.emit('info', { id, info });
			return;
		}

		if (line.startsWith('ERROR')) {
			const error = line.slice(6).trim();
			this.emit('error', new Error(error));
			return;
		}

		if (line.startsWith('LOG')) {
			const logSnippet = line.slice(4).trim();
			const [level, ...messageParts] = logSnippet.split(' ');
			const message = messageParts.join(' ');
			switch (level) {
				case 'INFO':
					log.info('agent', message);
					break;
				case 'WARN':
					log.warn('agent', message);
					break;
				case 'ERROR':
					log.error('agent', message);
					break;
				default:
					log.debug('agent', message);
			}

			return;
		}
	}
}
