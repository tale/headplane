import { hp_agentRequest } from '~server/ws/data';

export interface AppContext {
	hp_agentRequest: typeof hp_agentRequest;
}

export default function appContext(): AppContext {
	return {
		hp_agentRequest,
	};
}
