import docker from './docker'
import kubernetes from './kubernetes'
import proc from './proc'

export interface Integration {
	name: string
	preflight: () => Promise<boolean>
	sighup?: () => Promise<void>
	restart?: () => Promise<void>
}

// Because we previously supported the Docker integration by
// checking for the HEADSCALE_CONTAINER variable, we need to
// check for it here as well.
//
// This ensures that when people upgrade from older versions
// of Headplane, they don't explicitly need to define the new
// HEADSCALE_INTEGRATION variable that is needed to configure
// an integration.
export async function checkIntegration() {
	let integration = process.env.HEADSCALE_INTEGRATION
		?.trim()
		.toLowerCase()

	// Old HEADSCALE_CONTAINER variable upgrade path
	if (!integration && process.env.HEADSCALE_CONTAINER) {
		integration = 'docker'
	}

	if (!integration) {
		console.log('Running Headplane without any integrations')
		return
	}

	let module: Integration | undefined
	try {
		module = getIntegration(integration)
		await module.preflight()
	} catch (error) {
		console.error('Failed to load integration', error)
		return
	}

	return module
}

function getIntegration(name: string) {
	switch (name) {
		case 'docker': {
			return docker
		}
		case 'proc': {
			return proc
		}
		case 'kubernetes':
		case 'k8s': {
			return kubernetes
		}
		default: {
			throw new Error(`Unknown integration: ${name}`)
		}
	}
}
