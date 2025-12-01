interface ErrorCodes {
	CONFLICTING_SECRET_PATH_FIELD: {
		fieldName: string;
	};

	INVALID_REQUIRED_FIELDS: {
		messages: string[];
	};

	MISSING_INTERPOLATION_VARIABLE: {
		pathKey: string;
		variableName: string;
	};

	MISSING_SECRET_FILE: {
		pathKey: string;
		filePath: string;
	};
}

const translationsWithVars: {
	[K in keyof ErrorCodes]: (vars: ErrorCodes[K]) => string;
} = {
	CONFLICTING_SECRET_PATH_FIELD: ({ fieldName }) =>
		`Both "${fieldName}" and "${fieldName}_path" are set; please provide only one of these fields.`,
	INVALID_REQUIRED_FIELDS: ({ messages }) =>
		`The configuration is missing required fields or has invalid values:\n- ${messages.join('\n- ')}`,
	MISSING_INTERPOLATION_VARIABLE: ({ pathKey, variableName }) =>
		`Could not resolve environment variable "${variableName}" for configuration key "${pathKey}".`,

	MISSING_SECRET_FILE: ({ pathKey, filePath }) =>
		`The secret file specified in "${pathKey}" could not be accessed at path "${filePath}". Please ensure the file exists and is readable.`,
} as const;

/**
 * Custom error class for configuration-related errors.
 */
export class ConfigError extends Error {
	/**
	 * The error code representing the type of configuration error.
	 */
	code: keyof ErrorCodes;

	/**
	 * Creates a new ConfigError instance.
	 *
	 * @param code The error code
	 * @param vars The variables to interpolate into the error message
	 */
	constructor(code: keyof ErrorCodes, vars: unknown) {
		super(
			translationsWithVars[code](
				vars as (typeof translationsWithVars)[typeof code] extends (
					vars: infer U,
				) => string
					? U
					: never,
			),
		);
		this.code = code;
		this.name = 'ConfigError';
	}

	/**
	 * Factory method to create a ConfigError instance.
	 *
	 * @param code The error code
	 * @param vars The variables to interpolate into the error message
	 * @returns A new ConfigError instance
	 */
	static from<K extends keyof ErrorCodes>(code: K, vars: ErrorCodes[K]) {
		return new ConfigError(code, vars);
	}
}
