import hashes from '~/openapi-operation-hashes.json';
import log from '~/utils/log';

/**
 * The known API versions based on operation hashes.
 */
export type Version = keyof typeof hashes;
const VERSIONS = Object.keys(hashes) as Version[];

/**
 * Detects the closest matching API version using operation hashes.
 * Falls back to the latest known version and emits a warning if unknown.
 *
 * @param observed - A mapping of operation identifiers to their hashes.
 * @returns The detected API version.
 */
export function detectApiVersion(
	observed: Record<string, string> | null,
): Version {
	if (!observed) {
		const latest = VERSIONS.at(-1)!;
		log.warn(
			'api',
			'No operation hashes observed, defaulting to version %s',
			latest,
		);
		return latest;
	}

	let bestVersion: Version | null = null;
	let bestScore = -1;

	for (const [version, known] of Object.entries(hashes) as [
		Version,
		Record<string, string>,
	][]) {
		let score = 0;
		for (const [op, hash] of Object.entries(observed)) {
			if (known[op] === hash) score++;
		}
		if (score > bestScore) {
			bestVersion = version;
			bestScore = score;
		}
	}

	if (!bestVersion || bestScore === 0) {
		const latest = VERSIONS.at(-1)!;
		log.warn(
			'api',
			'Could not determine API version, defaulting to %s',
			latest,
		);
		return latest;
	}

	if (bestScore < Object.keys(observed).length) {
		log.warn(
			'api',
			'Partial version match: %d/%d endpoints for version %s',
			bestScore,
			Object.keys(observed).length,
			bestVersion,
		);
	}

	return bestVersion;
}

/**
 * Checks if the current version is at least the baseline version.
 *
 * @param current - The current API version.
 * @param baseline - The baseline API version to compare against.
 * @returns True if current is at least baseline, false otherwise.
 */
export function isAtLeast(current: Version, baseline: Version) {
	return VERSIONS.indexOf(current) >= VERSIONS.indexOf(baseline);
}
