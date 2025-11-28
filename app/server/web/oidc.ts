import * as oidc from 'openid-client';
import log from '~/utils/log';
import { HeadplaneConfig } from '../config/schema';
import type { RuntimeApiClient } from '../headscale/api/endpoints';
import { isDataUnauthorizedError } from '../headscale/api/error-client';

export type OidcConfig = NonNullable<HeadplaneConfig['oidc']>;
export type OidcConfigError = string;

export async function configureOidcAuth(
	config: OidcConfig,
	client: RuntimeApiClient,
): Promise<oidc.Configuration | OidcConfigError> {
	// Don't waste any of our time if the OIDC API key is invalid
	try {
		await client.getApiKeys();
	} catch (error) {
		if (isDataUnauthorizedError(error)) {
			return [
				'The supplied API key for OIDC is invalid.',
				'OIDC will be disabled until a valid API key is given',
			].join(' ');
		}

		// MARK: Otherwise assume the API key is valid since the API request
		// failed for another reason that isn't 401
	}

	log.debug('config', 'Running OIDC discovery for %s', config.issuer);
	let clientAuthMethod: oidc.ClientAuth;
	switch (config.token_endpoint_auth_method) {
		case 'client_secret_basic':
			clientAuthMethod = oidc.ClientSecretBasic(config.client_secret!);
			break;
		case 'client_secret_post':
			clientAuthMethod = oidc.ClientSecretPost(config.client_secret!);
			break;
		case 'client_secret_jwt':
			clientAuthMethod = oidc.ClientSecretJwt(config.client_secret!);
			break;
		default:
			// MARK: Throwing because this is a developer skill issue
			throw new Error('Invalid client authentication method');
	}

	let oidcClient: oidc.Configuration;
	try {
		const discovery = await oidc.discovery(
			new URL(config.issuer),
			config.client_id,
			config.client_secret!, // TODO: Fix this config schema
			clientAuthMethod,
		);

		const meta = discovery.serverMetadata();
		if (!meta.authorization_endpoint) {
			log.error(
				'config',
				'Issuer discovery did not return `authorization_endpoint`',
			);
			log.error(
				'config',
				'OIDC server does not support authorization code flow',
			);
			log.error('config', 'You may need to set this manually in the config');
			return 'OIDC provider did not return `authorization_endpoint`, please check logs';
		}

		if (!meta.token_endpoint) {
			log.error('config', 'Issuer discovery did not return `token_endpoint`');
			log.error(
				'config',
				'OIDC server does not support authorization code flow',
			);
			log.error('config', 'You may need to set this manually in the config');
			return 'OIDC provider did not return `token_endpoint`, please check logs';
		}

		if (!meta.userinfo_endpoint) {
			log.error(
				'config',
				'Issuer discovery did not return `userinfo_endpoint`',
			);
			log.error('config', 'OIDC server does not support user info endpoint');
			log.error('config', 'You may need to set this manually in the config');
			return 'OIDC provider did not return `user_info`, please check logs';
		}

		if (meta.token_endpoint_auth_methods_supported) {
			if (
				!meta.token_endpoint_auth_methods_supported.includes(
					config.token_endpoint_auth_method,
				)
			) {
				log.error(
					'config',
					'OIDC server does not support client authentication method %s',
					config.token_endpoint_auth_method,
				);
				log.error(
					'config',
					'Supported methods: %s',
					meta.token_endpoint_auth_methods_supported.join(', '),
				);

				return [
					'Headplane is expecting the following client authencation method:',
					config.token_endpoint_auth_method,
					'while the OIDC server only supports',
					`${meta.token_endpoint_auth_methods_supported.join(', ')}.`,
					'OIDC wil be disabled until configured correctly.',
				].join(' ');
			}
		}

		log.debug('config', 'OIDC discovery successful');
		log.debug(
			'config',
			'Authorization endpoint: %s',
			meta.authorization_endpoint,
		);
		log.debug('config', 'Token endpoint: %s', meta.token_endpoint);
		log.debug('config', 'Userinfo endpoint: %s', meta.userinfo_endpoint);

		// Manually construct the endpoints to coalesce with config if needed
		oidcClient = new oidc.Configuration(
			{
				issuer: config.issuer,
				authorization_endpoint:
					config.authorization_endpoint || meta.authorization_endpoint,
				token_endpoint: config.token_endpoint || meta.token_endpoint,
				userinfo_endpoint: config.userinfo_endpoint || meta.userinfo_endpoint,
			},
			config.client_id,
			config.client_secret!,
			clientAuthMethod,
		);
	} catch (err) {
		log.error('config', 'OIDC discovery failed: %s', err);
		log.debug('config', 'Error details: %o', err);
		log.error(
			'config',
			'This may be an error, or the server may not support discovery',
		);

		if (
			!config.authorization_endpoint ||
			!config.token_endpoint ||
			!config.userinfo_endpoint
		) {
			log.error(
				'config',
				'Endpoints are not fully configured, cannot continue',
			);
			log.error(
				'config',
				'You must set authorization_endpoint, token_endpoint and userinfo_endpoint manually in the config or fix the discovery issue',
			);
			return 'OIDC provider could not be configured, please check logs.';
		}

		oidcClient = new oidc.Configuration(
			{
				issuer: config.issuer,
				authorization_endpoint: config.authorization_endpoint,
				token_endpoint: config.token_endpoint,
				userinfo_endpoint: config.userinfo_endpoint,
			},
			config.client_id,
			config.client_secret!,
			clientAuthMethod,
		);

		log.debug('config', 'Using manually configured endpoints');
		log.debug(
			'config',
			'Authorization endpoint: %s',
			config.authorization_endpoint,
		);
		log.debug('config', 'Token endpoint: %s', config.token_endpoint);
		log.debug('config', 'Userinfo endpoint: %s', config.userinfo_endpoint);
	}

	log.info('config', 'Successfully configured OIDC authentication');
	return oidcClient;
}
