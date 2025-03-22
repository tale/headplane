import { readFile } from 'node:fs/promises';
import * as client from 'openid-client';
import log from '~/utils/log';
import type { HeadplaneConfig } from '../config/schema';

async function loadClientSecret(path: string) {
	// We need to interpolate environment variables into the path
	// Path formatting can be like ${ENV_NAME}/path/to/secret
	const matches = path.match(/\${(.*?)}/g);
	let resolvedPath = path;

	if (matches) {
		for (const match of matches) {
			const env = match.slice(2, -1);
			const value = process.env[env];
			if (!value) {
				log.error('config', 'Environment variable %s is not set', env);
				return;
			}

			log.debug('config', 'Interpolating %s with %s', match, value);
			resolvedPath = resolvedPath.replace(match, value);
		}
	}

	try {
		log.debug('config', 'Reading client secret from %s', resolvedPath);
		const secret = await readFile(resolvedPath, 'utf-8');
		if (secret.trim().length === 0) {
			log.error('config', 'Empty OIDC client secret');
			return;
		}

		return secret;
	} catch (error) {
		log.error('config', 'Failed to read client secret from %s', path);
		log.error('config', 'Error: %s', error);
		log.debug('config', 'Error details: %o', error);
	}
}

function clientAuthMethod(
	method: string,
): (secret: string) => client.ClientAuth {
	switch (method) {
		case 'client_secret_post':
			return client.ClientSecretPost;
		case 'client_secret_basic':
			return client.ClientSecretBasic;
		case 'client_secret_jwt':
			return client.ClientSecretJwt;
		default:
			throw new Error('Invalid client authentication method');
	}
}

// Loads and configures an OIDC client to support OIDC authentication.
// This runs under the assumption the OIDC configuration exists and is valid.
// If it is invalid, Headplane automatically disables it.
//
// TODO: Support custom endpoints instead of relying on OIDC discovery.
// This will enable us to support servers like GitHub that do not support
// nor advertise a .well-known endpoint.
export async function createOidcClient(
	config: NonNullable<HeadplaneConfig['oidc']>,
) {
	// const secret = await loadClientSecret(oidc);
	const secret = config.client_secret_path
		? await loadClientSecret(config.client_secret_path)
		: config.client_secret;

	if (!secret) {
		log.error('config', 'Missing an OIDC client secret');
		return;
	}

	log.debug('config', 'Running OIDC discovery for %s', config.issuer);
	const oidc = await client.discovery(
		new URL(config.issuer),
		config.client_id,
		secret,
		clientAuthMethod(config.token_endpoint_auth_method)(secret),
	);

	const metadata = oidc.serverMetadata();
	if (!metadata.authorization_endpoint) {
		log.error(
			'config',
			'Issuer discovery did not return `authorization_endpoint`',
		);
		log.error('config', 'OIDC server does not support authorization code flow');
		return;
	}

	if (!metadata.token_endpoint) {
		log.error('config', 'Issuer discovery did not return `token_endpoint`');
		log.error('config', 'OIDC server does not support token exchange');
		return;
	}

	// If this field is missing, assume the server supports all response types
	// and that we can continue safely.
	if (metadata.response_types_supported) {
		if (!metadata.response_types_supported.includes('code')) {
			log.error(
				'config',
				'Issuer discovery `response_types_supported` does not include `code`',
			);
			log.error('config', 'OIDC server does not support code flow');
			return;
		}
	}

	if (metadata.token_endpoint_auth_methods_supported) {
		if (
			!metadata.token_endpoint_auth_methods_supported.includes(
				config.token_endpoint_auth_method,
			)
		) {
			log.error(
				'config',
				'Issuer discovery `token_endpoint_auth_methods_supported` does not include `%s`',
				config.token_endpoint_auth_method,
			);
			log.error(
				'config',
				'OIDC server does not support %s',
				config.token_endpoint_auth_method,
			);
			return;
		}
	}

	if (!metadata.userinfo_endpoint) {
		log.error('config', 'Issuer discovery did not return `userinfo_endpoint`');
		log.error('config', 'OIDC server does not support userinfo endpoint');
		return;
	}

	log.debug('config', 'OIDC client created successfully');
	log.info('config', 'Using %s as the OIDC issuer', config.issuer);
	log.debug(
		'config',
		'Authorization endpoint: %s',
		metadata.authorization_endpoint,
	);
	log.debug('config', 'Token endpoint: %s', metadata.token_endpoint);
	log.debug('config', 'Userinfo endpoint: %s', metadata.userinfo_endpoint);
	return oidc;
}
