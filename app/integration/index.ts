import dockerIntegration from './docker'
import kubernetesIntegration from './kubernetes'
import procIntegration from './proc'

export * from './integration'

export function loadIntegration() {
	let integration = process.env.HEADSCALE_INTEGRATION
		?.trim()
		.toLowerCase()

	// Old HEADSCALE_CONTAINER variable upgrade path
	// This ensures that when people upgrade from older versions of Headplane
	// they don't explicitly need to define the new HEADSCALE_INTEGRATION
	// variable that is needed to configure docker
	if (!integration && process.env.HEADSCALE_CONTAINER) {
		integration = 'docker'
	}

	if (!integration) {
		console.log('Running Headplane without any integrations')
		return
	}

	switch (integration.toLowerCase().trim()) {
		case 'docker': {
			return dockerIntegration
		}

		case 'proc':
		case 'native':
		case 'linux': {
			return procIntegration
		}

		case 'kubernetes':
		case 'k8s': {
			return kubernetesIntegration
		}
	}

	console.error('Unknown integration:', integration)
}
