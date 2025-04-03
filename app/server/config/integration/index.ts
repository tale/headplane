import { HeadplaneConfig } from '~/server/config/schema';
import log from '~/utils/log';
import dockerIntegration from './docker';
import kubernetesIntegration from './kubernetes';
import procIntegration from './proc';

export async function loadIntegration(context: HeadplaneConfig['integration']) {
	const integration = getIntegration(context);
	if (!integration) {
		return;
	}

	try {
		const res = await integration.isAvailable();
		if (!res) {
			log.error('config', 'Integration %s is not available', integration);
			return;
		}
	} catch (error) {
		log.error(
			'config',
			'Failed to load integration %s: %s',
			integration,
			error,
		);
		log.debug('config', 'Loading error: %o', error);
		return;
	}

	return integration;
}

function getIntegration(integration: HeadplaneConfig['integration']) {
	const docker = integration?.docker;
	const k8s = integration?.kubernetes;
	const proc = integration?.proc;

	if (!docker?.enabled && !k8s?.enabled && !proc?.enabled) {
		log.debug('config', 'No integrations enabled');
		return;
	}

	if (docker?.enabled && k8s?.enabled && proc?.enabled) {
		log.error('config', 'Multiple integrations enabled, please pick one only');
		return;
	}

	if (docker?.enabled) {
		log.info('config', 'Using Docker integration');
		return new dockerIntegration(integration?.docker);
	}

	if (k8s?.enabled) {
		log.info('config', 'Using Kubernetes integration');
		return new kubernetesIntegration(integration?.kubernetes);
	}

	if (proc?.enabled) {
		log.info('config', 'Using Proc integration');
		return new procIntegration(integration?.proc);
	}
}
