import * as oidc from 'openid-client';
import log from '~/utils/log';
import type { HeadplaneConfig } from '../config/config-schema';
import type { RuntimeApiClient } from '../headscale/api/endpoints';
import { isDataUnauthorizedError } from '../headscale/api/error-client';

export type OidcConfig = NonNullable<HeadplaneConfig['oidc']>;

/**
 * Errors that can occur during OIDC connector setup and validation.
 */
export type OidcConnectorError =
	| 'INVALID_API_KEY'
	| 'MISSING_AUTHORIZATION_ENDPOINT'
	| 'MISSING_TOKEN_ENDPOINT'
	| 'MISSING_USERINFO_ENDPOINT'
	| 'MISSING_REQUIRED_CLAIMS'
	| 'UNKNOWN_ERROR';

/**
 * Represents a "configured" OIDC setup for Headplane.
 * This may include mis-configured versions too and will surface error messages.
 */
export type OidcConnector =
	| {
			isValid: true;
			isExclusive: boolean;
			usePKCE: boolean;
			client: oidc.Configuration;
			apiKey: string;
			scope: string;
			extraParams?: Record<string, string>;
	  }
	| {
			isValid: false;
			isExclusive: false;
			errors: OidcConnectorError[];
	  };

/**
 * Creates an OIDC connector based on the configuration and Headscale API.
 * This will attempt to validate the configuration and return any errors.
 *
 * @param baseUrl The base URL of the Headplane server.
 * @param config The OIDC configuration.
 * @param client The Headscale runtime API client.
 * @returns An OIDC connector with validation status.
 */
export async function createOidcConnector(
	baseUrl: string | undefined,
	config: OidcConfig,
	client: RuntimeApiClient,
): Promise<OidcConnector> {
	if (baseUrl == null && config.redirect_uri == null) {
		log.warn(
			'config',
			'OIDC is enabled but `server.base_url` is not set in the config. Starting in Headplane 0.7.0 this will be required for OIDC to function properly and will throw errors if not set, see https://headplane.net/features/sso#configuring-oidc for more information.',
		);
	}

	const errors: OidcConnectorError[] = [];
	if (!config.headscale_api_key) {
		errors.push('INVALID_API_KEY');
		return {
			isValid: false,
			isExclusive: false,
			errors,
		};
	}

	try {
		await client.getApiKeys();
	} catch (error) {
		if (isDataUnauthorizedError(error)) {
			errors.push('INVALID_API_KEY');
			return {
				isValid: false,
				isExclusive: false,
				errors,
			};
		}

		// MARK: Otherwise assume the API key is valid since the API request
		// failed for another reason that isn't 401 and we are optimistic
	}

	const oidcClientOrErrors = await discoveryCoalesce(config);
	if (Array.isArray(oidcClientOrErrors)) {
		errors.push(...oidcClientOrErrors);
		return {
			isValid: false,
			isExclusive: false,
			errors,
		};
	}

	return {
		isValid: true,
		isExclusive: config.disable_api_key_login,
		usePKCE: config.use_pkce,
		client: oidcClientOrErrors,
		apiKey: config.headscale_api_key,
		scope: config.scope,
		extraParams: config.extra_params,
	};
}

/**
 * Runs OIDC discovery and coalesces the results with the provided config.
 * We treat the manually supplied values as overrides to discovery.
 *
 * @param config The OIDC configuration.
 * @returns The coalesced OIDC configuration or an array of errors.
 */
async function discoveryCoalesce(
	config: OidcConfig,
): Promise<oidc.Configuration | OidcConnectorError[]> {
	let metadata: oidc.ServerMetadata;
	try {
		const client = await oidc.discovery(
			new URL(config.issuer),
			config.client_id,
		);
		metadata = client.serverMetadata();
		if (config.use_pkce === true && !client.serverMetadata().supportsPKCE()) {
			log.warn(
				'config',
				'OIDC provider does not support PKCE, but it is enabled in the config',
			);
		}

		if (metadata.claims_supported != null) {
			if (!metadata.claims_supported.includes('sub')) {
				log.error('config', 'OIDC provider does not support `sub` claim');
				return ['MISSING_REQUIRED_CLAIMS'];
			}

			if (!metadata.claims_supported.includes('name')) {
				if (
					!(
						metadata.claims_supported.includes('given_name') &&
						metadata.claims_supported.includes('family_name')
					)
				) {
					log.warn(
						'config',
						'OIDC provider does not support `name`, `given_name`, or `family_name` claims',
					);
				}
			}

			if (
				!metadata.claims_supported.includes('preferred_username') &&
				!metadata.claims_supported.includes('email')
			) {
				log.warn(
					'config',
					'OIDC provider does not support `preferred_username` or `email` claims',
				);
			}
		}
	} catch {
		log.error(
			'config',
			'Failed to auto-configure OIDC endpoints via discovery',
		);
		log.warn(
			'config',
			'OIDC server may not support discovery, using manual config',
		);
		metadata = {
			issuer: config.issuer,
		};
	}

	const errors: OidcConnectorError[] = [];
	const authorization_endpoint =
		config.authorization_endpoint ?? metadata.authorization_endpoint;

	const token_endpoint = config.token_endpoint ?? metadata.token_endpoint;

	const userinfo_endpoint =
		config.userinfo_endpoint ?? metadata.userinfo_endpoint;

	if (!authorization_endpoint) {
		errors.push('MISSING_AUTHORIZATION_ENDPOINT');
	}

	if (!token_endpoint) {
		errors.push('MISSING_TOKEN_ENDPOINT');
	}

	if (!userinfo_endpoint) {
		errors.push('MISSING_USERINFO_ENDPOINT');
	}

	if (errors.length > 0) {
		return errors;
	}

	const oidcClient = new oidc.Configuration(
		{
			issuer: config.issuer,
			authorization_endpoint,
			token_endpoint,
			userinfo_endpoint,
		},
		config.client_id,
		config.client_secret,
	);

	return oidcClient;
}
