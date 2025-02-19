import { hp_getConfig } from './loader';
import { HeadplaneConfig } from './parser';

export interface AppContext {
	context: HeadplaneConfig;
}

export default function appContext() {
	return {
		context: hp_getConfig(),
	};
}
