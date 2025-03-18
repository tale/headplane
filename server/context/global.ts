import type { Configuration } from 'openid-client';
import type { Agent } from 'undici';
import type { WebSocket } from 'ws';
import type { HostInfo } from '~/types';
import type { HeadplaneConfig } from '~server/context/parser';
import type { Logger } from '~server/utils/log';
import type { TimedCache } from '~server/ws/cache';

// This is a stupid workaround for how the Remix import context works
// Even though they run in the same Node instance, they have different
// contexts which means importing this in the app code will not work
// because it will be a different instance of the module.
//
// Instead we can rely on globalThis to share the module between the
// different contexts and use some helper functions to make it easier.
// As a part of this global module, we also define all our singletons
// here in order to avoid polluting the global scope and instead just using
// the `__headplane_server_context` object.

interface ServerContext {
	config: HeadplaneConfig;
	singletons: ServerSingletons;
}

interface ServerSingletons {
	api_agent: Agent;
	logger: Logger;
	oidc_client: Configuration;
	ws_agents: Map<string, WebSocket>;
	ws_agent_data: TimedCache<HostInfo>;
	ws_fetch_data: (nodeList: string[]) => Promise<void>;
}

// These declarations are separate to prevent the Remix context
// from modifying the globalThis object and causing issues with
// the server context.
declare namespace globalThis {
	let __headplane_server_context: {
		[K in keyof ServerContext]: ServerContext[K] | null | object;
	};
}

// We need to check if the context is already initialized and set a default
// value. This is fine as a side-effect since it's just setting up a framework
// for the object to get modified later.
if (!globalThis.__headplane_server_context) {
	globalThis.__headplane_server_context = {
		config: null,
		singletons: {},
	};
}

declare global {
	const __headplane_server_context: ServerContext;
}

export function hp_getConfig(): HeadplaneConfig {
	return __headplane_server_context.config;
}

export function hp_setConfig(config: HeadplaneConfig): void {
	__headplane_server_context.config = config;
}

export function hp_getSingleton<T extends keyof ServerSingletons>(
	key: T,
): ServerSingletons[T] {
	if (!__headplane_server_context.singletons[key]) {
		throw new Error(`Singleton ${key} not initialized`);
	}

	return __headplane_server_context.singletons[key];
}

export function hp_getSingletonUnsafe<T extends keyof ServerSingletons>(
	key: T,
): ServerSingletons[T] | undefined {
	return __headplane_server_context.singletons[key];
}

export function hp_setSingleton<
	T extends ServerSingletons[keyof ServerSingletons],
>(key: keyof ServerSingletons, value: T): void {
	(__headplane_server_context.singletons[key] as T) = value;
}
