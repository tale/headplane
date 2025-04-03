import type { ApiClient } from '~/server/headscale/api-client';

export abstract class Integration<T> {
	protected context: NonNullable<T>;
	constructor(context: T) {
		if (!context) {
			throw new Error('Missing integration context');
		}

		this.context = context;
	}

	abstract isAvailable(): Promise<boolean> | boolean;
	abstract onConfigChange(client: ApiClient): Promise<void> | void;
	abstract get name(): string;
}
