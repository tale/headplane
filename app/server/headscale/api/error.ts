import { errors } from 'undici';

/**
 * Helper function that determines if an error is a Node.js exception
 * @param - The error to check
 * @returns True if the error is a Node.js exception, false otherwise
 */
function isNodeNetworkError(error: unknown): error is NodeJS.ErrnoException {
	return (
		error != null &&
		typeof error === 'object' &&
		'code' in error &&
		'errno' in error
	);
}

/**
 * A friendly error representation for Headscale connection issues.
 */
export interface HeadscaleConnectionError {
	requestUrl: string;
	errorCode: string;
	errorMessage: string;
	extraData: Record<string, unknown> | null;
}

/**
 * Convert an Undici error into a friendly HeadscaleAPIError.
 * This is used to avoid exposing rough error edges to the user.
 *
 * @param error - The Undici error to convert.
 * @param requestUrl - The URL of the request that caused the error.
 * @returns A friendly HeadscaleAPIError.
 */
export function undiciToFriendlyError(
	error: unknown,
	requestUrl: string,
): HeadscaleConnectionError {
	// MARK: Do we need to go deeper into causes here?
	if (error instanceof AggregateError) {
		error = error.errors[0];
	}

	if (error instanceof errors.UndiciError) {
		return {
			requestUrl,
			errorCode: error.code,
			errorMessage: error.message,
			extraData: null,
		};
	}

	if (isNodeNetworkError(error)) {
		return {
			requestUrl,
			errorCode: error.code ?? 'UNKNOWN_NODE_NETWORK_ERROR',
			errorMessage: error.message,
			extraData: {
				syscall: error.syscall,
				path: error.path,
				errno: error.errno,
			},
		};
	}

	return {
		requestUrl,
		errorCode: 'UNKNOWN_ERROR',
		errorMessage: 'An unknown error occured',
		extraData: null,
	};
}
