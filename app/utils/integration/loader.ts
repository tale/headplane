import { hp_getConfig } from '~server/context/global';
import { HeadplaneConfig } from '~server/context/parser';
import log from '~server/utils/log';
import { Integration } from './abstract';
import dockerIntegration from './docker';
import kubernetesIntegration from './kubernetes';
import procIntegration from './proc';

let runtimeIntegration: Integration<unknown> | undefined = undefined;

export function hp_getIntegration() {
	return runtimeIntegration;
}

export async function hp_loadIntegration(
	context: HeadplaneConfig['integration'],
) {
	const integration = getIntegration(context);
	if (!integration) {
		return;
	}

	try {
		const res = await integration.isAvailable();
		if (!res) {
			log.error('INTG', 'Integration %s is not available', integration);
			return;
		}
	} catch (error) {
		log.error('INTG', 'Failed to load integration %s: %s', integration, error);
		log.debug('INTG', 'Loading error: %o', error);
		return;
	}

	runtimeIntegration = integration;
}

function getIntegration(integration: HeadplaneConfig['integration']) {
	const docker = integration?.docker;
	const k8s = integration?.kubernetes;
	const proc = integration?.proc;

	if (!docker?.enabled && !k8s?.enabled && !proc?.enabled) {
		log.debug('INTG', 'No integrations enabled');
		return;
	}

	if (docker?.enabled && k8s?.enabled && proc?.enabled) {
		log.error('INTG', 'Multiple integrations enabled, please pick one only');
		return;
	}

	if (docker?.enabled) {
		log.info('INTG', 'Using Docker integration');
		return new dockerIntegration(integration?.docker);
	}

	if (k8s?.enabled) {
		log.info('INTG', 'Using Kubernetes integration');
		return new kubernetesIntegration(integration?.kubernetes);
	}

	if (proc?.enabled) {
		log.info('INTG', 'Using Proc integration');
		return new procIntegration(integration?.proc);
	}
}

// IMPORTANT THIS IS A SIDE EFFECT ON INIT
// TODO: Switch this to the new singleton system
const context = hp_getConfig();
hp_loadIntegration(context.integration);
