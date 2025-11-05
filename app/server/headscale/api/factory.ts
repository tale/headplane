import type { HeadscaleApiInterface } from '../api';

/**
 * Creates a strongly-typed group factory for a given endpoint interface.
 *
 * Example:
 *   export const apiKeyGroup = defineGroup<ApiKeyEndpoints>({...})
 */

export interface EndpointFactory<T extends object> {
	__type?: T;
	(client: HeadscaleApiInterface['clientHelpers'], apiKey: string): T;
}

export function defineApiEndpoints<T extends object>(
	factories: (
		client: HeadscaleApiInterface['clientHelpers'],
		apiKey: string,
	) => T,
): EndpointFactory<T> {
	return factories;
}

export type ExtractApiEndpoints<F> = F extends EndpointFactory<infer T>
	? T
	: never;
export type UnionToIntersection<U> = (
	U extends any
		? (k: U) => void
		: never
) extends (k: infer I) => void
	? I
	: never;

/**
 * Compose multiple endpoint sets into a single typed runtime client
 */
export function composeEndpoints<T extends readonly EndpointFactory<any>[]>(
	factories: T,
	clientHelpers: any,
	apiKey: string,
): UnionToIntersection<ExtractApiEndpoints<T[number]>> {
	const instances = factories.map((f) => f(clientHelpers, apiKey));
	return Object.assign({}, ...instances) as any;
}
