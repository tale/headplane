// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface IntegrationFactory<T = any> {
	name: string
	context: T
	isAvailable: (context: T) => Promise<boolean> | boolean
	onAclChange?: (context: T) => Promise<void> | void
	onConfigChange?: (context: T) => Promise<void> | void
}

export function createIntegration<T>(
	options: IntegrationFactory<T>,
) {
	return options
}
