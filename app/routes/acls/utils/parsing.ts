import {
	extractTestsFromPolicy,
	parsePolicy,
	type TestACLResponse,
} from '~/server/headscale/api/endpoints/policy';

// Re-export for convenience
export { extractTestsFromPolicy, parsePolicy };

/**
 * Represents a syntax error with location information.
 */
export interface SyntaxErrorLocation {
	line: number;
	column: number;
	message: string;
}

/**
 * Parse an error message to extract line/column information.
 * Supports formats like:
 * - "hujson: line 67, column 5: invalid character..."
 * - "Syntax Error: line 67, column 5: ..."
 * - JSON.parse errors: "... at position 1234"
 */
export function parseSyntaxErrorLocation(
	error: string,
	policyContent?: string,
): SyntaxErrorLocation | undefined {
	// Pattern for "line X, column Y" format (Headscale/hujson)
	const lineColMatch = error.match(/line\s+(\d+),?\s*column\s+(\d+)/i);
	if (lineColMatch) {
		return {
			line: Number.parseInt(lineColMatch[1], 10),
			column: Number.parseInt(lineColMatch[2], 10),
			message: error,
		};
	}

	// Pattern for "at line X" format
	const lineOnlyMatch = error.match(/at\s+line\s+(\d+)/i);
	if (lineOnlyMatch) {
		return {
			line: Number.parseInt(lineOnlyMatch[1], 10),
			column: 1,
			message: error,
		};
	}

	// Pattern for JSON.parse "at position N" - convert to line/column
	const positionMatch = error.match(/at\s+position\s+(\d+)/i);
	if (positionMatch && policyContent) {
		const position = Number.parseInt(positionMatch[1], 10);
		const beforeError = policyContent.substring(0, position);
		const lines = beforeError.split('\n');
		return {
			line: lines.length,
			column: (lines[lines.length - 1]?.length ?? 0) + 1,
			message: error,
		};
	}

	return undefined;
}

/**
 * Extract error message from API error data.
 */
export function getApiErrorMessage(errorData: unknown): string | undefined {
	if (
		errorData != null &&
		typeof errorData === 'object' &&
		'message' in errorData &&
		typeof errorData.message === 'string'
	) {
		return errorData.message;
	}
	return undefined;
}

/**
 * Parse syntax error message based on Headscale version.
 */
export function parseSyntaxError(
	message: string,
	isModernVersion: boolean,
): string | undefined {
	const patterns = isModernVersion
		? [
				{ match: 'parsing HuJSON:', offset: 16 },
				{ match: 'parsing policy from bytes:', offset: 26 },
			]
		: [
				{ match: 'err: hujson:', offset: 12, trigger: 'parsing hujson' },
				{ match: 'err:', offset: 5, trigger: 'unmarshalling policy' },
			];

	for (const pattern of patterns) {
		const trigger = 'trigger' in pattern ? pattern.trigger : pattern.match;
		if (!message.includes(trigger)) continue;

		const cutIndex = message.indexOf(pattern.match);
		if (cutIndex > -1) {
			return `Syntax Error: ${message.slice(cutIndex + pattern.offset).trim()}`;
		}
		return message;
	}

	return undefined;
}

/**
 * Try to parse test results from an error response.
 * Returns undefined if the error doesn't contain test results.
 */
export function parseTestResultsFromError(
	errorData: Record<string, unknown> | null,
	policyData: string,
): TestACLResponse | undefined {
	if (!errorData) return undefined;

	const results = errorData.results;
	if (!Array.isArray(results)) return undefined;

	const originalTests = extractTestsFromPolicy(policyData);

	const parsedResults = results.map((r: unknown, index: number) => {
		if (typeof r !== 'object' || r === null) {
			return { src: 'unknown', passed: false, testIndex: index };
		}

		const result = r as Record<string, unknown>;
		return {
			src: typeof result.src === 'string' ? result.src : 'unknown',
			passed: result.passed === true,
			errors: Array.isArray(result.errors) ? result.errors : undefined,
			acceptOk: Array.isArray(result.accept_ok) ? result.accept_ok : undefined,
			acceptFail: Array.isArray(result.accept_fail)
				? result.accept_fail
				: undefined,
			denyOk: Array.isArray(result.deny_ok) ? result.deny_ok : undefined,
			denyFail: Array.isArray(result.deny_fail) ? result.deny_fail : undefined,
			testIndex: index,
			proto: originalTests[index]?.proto,
			accept: originalTests[index]?.accept,
			deny: originalTests[index]?.deny,
		};
	});

	return {
		allPassed: parsedResults.every((r) => r.passed),
		results: parsedResults,
	};
}
