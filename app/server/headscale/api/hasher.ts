import { createHash } from 'node:crypto';
import { dereference } from '@readme/openapi-parser';
import { OpenAPIV2 } from 'openapi-types';

/**
 * A map of operation IDs to their hashes.
 */
export interface DocumentHash {
	[operationId: string]: string;
}

/**
 * Given an OpenAPI v2 document, generate a map of operations with hashes.
 * This gives us deterministic identifers to determine the version of Headscale
 * that is being used at runtime.
 *
 * @param doc The OpenAPI v2 document to hash.
 * @returns A map of operation IDs to their hashes.
 */
export async function hashOpenApiDocument(
	doc: OpenAPIV2.Document,
): Promise<DocumentHash> {
	const spec = await dereference(doc);
	const hashes: DocumentHash = {};
	const seen = new Set<string>();

	for (const [path, item] of Object.entries(spec.paths)) {
		for (const [method, operation] of Object.entries(item)) {
			if (typeof operation !== 'object') {
				continue;
			}

			const { parameters, responses } = operation as OpenAPIV2.OperationObject;
			const raw = JSON.stringify(
				{
					path,
					method: method.toUpperCase(),
					parameters,
					responses,
				},
				Object.keys({ path, method, parameters, responses }).sort(),
			);

			const hash = createHash('md5').update(raw).digest('hex').slice(0, 16);
			const final = seen.has(hash) ? `${hash}_${seen.size}` : hash;
			seen.add(final);
			hashes[`${method.toUpperCase()} ${path}`] = final;
		}
	}

	return hashes;
}
