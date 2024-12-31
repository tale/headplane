import log from '~/utils/log';

import dockerIntegration from './docker';
import { IntegrationFactory } from './integration';
import kubernetesIntegration from './kubernetes';
import procIntegration from './proc';

export * from './integration';

export async function loadIntegration() {
	let integration = process.env.HEADSCALE_INTEGRATION?.trim().toLowerCase();

	// Old HEADSCALE_CONTAINER variable upgrade path
	// This ensures that when people upgrade from older versions of Headplane
	// they don't explicitly need to define the new HEADSCALE_INTEGRATION
	// variable that is needed to configure docker
	if (!integration && process.env.HEADSCALE_CONTAINER) {
		integration = 'docker';
	}

	if (!integration) {
		log.info('INTG', 'No integration set with HEADSCALE_INTEGRATION');
		return;
	}

	let integrationFactory: IntegrationFactory | undefined;
	switch (integration.toLowerCase().trim()) {
		case 'docker': {
			integrationFactory = dockerIntegration;
			break;
		}

		case 'proc':
		case 'native':
		case 'linux': {
			integrationFactory = procIntegration;
			break;
		}

		case 'kubernetes':
		case 'k8s': {
			integrationFactory = kubernetesIntegration;
			break;
		}

		default: {
			log.error('INTG', 'Unknown integration: %s', integration);
			throw new Error(`Unknown integration: ${integration}`);
		}
	}

	log.info('INTG', 'Loading integration: %s', integration);
	try {
		const res = await integrationFactory.isAvailable(
			integrationFactory.context,
		);
		if (!res) {
			log.error('INTG', 'Integration %s is not available', integration);
			return;
		}
	} catch (error) {
		log.error('INTG', 'Failed to load integration %s: %s', integration, error);
		return;
	}

	log.info('INTG', 'Loaded integration: %s', integration);
	return integrationFactory;
}
