import * as oidc from 'openid-client';
import log from '~/utils/log';
import { HeadplaneConfig } from '../config/schema';

export type OidcConfig = NonNullable<HeadplaneConfig['oidc']>;

export async function configureOidcAuth(config: OidcConfig) {
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
			return;
		}

		if (!meta.token_endpoint) {
			log.error('config', 'Issuer discovery did not return `token_endpoint`');
			log.error(
				'config',
				'OIDC server does not support authorization code flow',
			);
			log.error('config', 'You may need to set this manually in the config');
			return;
		}

		if (!meta.userinfo_endpoint) {
			log.error(
				'config',
				'Issuer discovery did not return `userinfo_endpoint`',
			);
			log.error('config', 'OIDC server does not support user info endpoint');
			log.error('config', 'You may need to set this manually in the config');
			return;
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
				return;
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
			return;
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
