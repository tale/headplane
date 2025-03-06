import type { HostInfo } from '~/types';
import { TimedCache } from '~server/ws/cache';
import { hp_agentRequest, hp_getAgentCache } from '~server/ws/data';
import { hp_getConfig } from './loader';
import type { HeadplaneConfig } from './parser';

export interface AppContext {
	context: HeadplaneConfig;
	agentData?: TimedCache<HostInfo>;
	hp_agentRequest: typeof hp_agentRequest;
}

export default function appContext() {
	return {
		context: hp_getConfig(),
		agentData: hp_getAgentCache(),
		hp_agentRequest,
	};
}
