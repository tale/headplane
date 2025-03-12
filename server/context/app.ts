import type { HostInfo } from '~/types';
import { TimedCache } from '~server/ws/cache';
import { hp_agentRequest, hp_getAgentCache } from '~server/ws/data';
import { hp_getAgents } from '~server/ws/socket';
import { hp_getConfig } from './loader';
import type { HeadplaneConfig } from './parser';

export interface AppContext {
	context: HeadplaneConfig;
	hp_agentRequest: typeof hp_agentRequest;
	agents: string[];
	agentData?: TimedCache<HostInfo>;
}

export default function appContext(): AppContext {
	return {
		context: hp_getConfig(),
		hp_agentRequest,
		agents: [...hp_getAgents().keys()],
		agentData: hp_getAgentCache(),
	};
}
