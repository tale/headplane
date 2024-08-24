// Handle the configuration loading for headplane.
// Functionally only used for all sorts of sanity checks across headplane.
//
// Around the codebase, this is referred to as the context

import { access, constants, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { parse } from 'yaml'

import { IntegrationFactory, loadIntegration } from '~/integration'
import { HeadscaleConfig, loadConfig } from '~/utils/config/headscale'
import log from '~/utils/log'

export interface HeadplaneContext {
	headscaleUrl: string
	cookieSecret: string
	integration: IntegrationFactory | undefined

	config: {
		read: boolean
		write: boolean
	}

	acl: {
		read: boolean
		write: boolean
	}

	oidc?: {
		issuer: string
		client: string
		secret: string
		rootKey: string
		disableKeyLogin: boolean
	}
}

let context: HeadplaneContext | undefined

export async function loadContext(): Promise<HeadplaneContext> {
	if (context) {
		return context
	}

	const path = resolve(process.env.CONFIG_FILE ?? '/etc/headscale/config.yaml')
	const { config, contextData } = await checkConfig(path)

	let headscaleUrl = process.env.HEADSCALE_URL
	if (!headscaleUrl && !config) {
		throw new Error('HEADSCALE_URL not set')
	}

	if (config) {
		headscaleUrl = headscaleUrl ?? config.server_url
	}

	if (!headscaleUrl) {
		throw new Error('Missing server_url in headscale config')
	}

	const cookieSecret = process.env.COOKIE_SECRET
	if (!cookieSecret) {
		throw new Error('COOKIE_SECRET not set')
	}

	context = {
		headscaleUrl,
		cookieSecret,
		integration: await loadIntegration(),
		config: contextData,
		acl: await checkAcl(config),
		oidc: await checkOidc(config),
	}

	log.info('CTXT', 'Starting Headplane with Context')
	log.info('CTXT', 'HEADSCALE_URL: %s', headscaleUrl)
	log.info('CTXT', 'Integration: %s', context.integration?.name ?? 'None')
	log.info('CTXT', 'Config: %s', contextData.read
		? `Found ${contextData.write ? '' : '(Read Only)'}`
		: 'Unavailable',
	)

	log.info('CTXT', 'OIDC: %s', context.oidc ? 'Configured' : 'Unavailable')
	return context
}

async function checkConfig(path: string) {
	let config: HeadscaleConfig | undefined
	try {
		config = await loadConfig(path)
	} catch {
		return {
			config: undefined,
			contextData: {
				read: false,
				write: false,
			},
		}
	}

	let write = false
	try {
		await access(path, constants.W_OK)
		write = true
	} catch {}

	return {
		config,
		contextData: {
			read: true,
			write,
		},
	}
}

async function checkOidc(config?: HeadscaleConfig) {
	const disableKeyLogin = process.env.DISABLE_API_KEY_LOGIN === 'true'
	const rootKey = process.env.ROOT_API_KEY ?? process.env.API_KEY
	if (!rootKey) {
		throw new Error('ROOT_API_KEY or API_KEY not set')
	}

	let issuer = process.env.OIDC_ISSUER
	let client = process.env.OIDC_CLIENT_ID
	let secret = process.env.OIDC_CLIENT_SECRET

	if (
		(issuer ?? client ?? secret)
		&& !(issuer && client && secret)
		&& !config
	) {
		throw new Error('OIDC environment variables are incomplete')
	}

	if (issuer && client && secret) {
		return {
			issuer,
			client,
			secret,
			rootKey,
			disableKeyLogin,
		}
	}

	if ((!issuer || !client || !secret) && config) {
		issuer = config.oidc?.issuer
		client = config.oidc?.client_id
		secret = config.oidc?.client_secret

		if (!secret && config.oidc?.client_secret_path) {
			try {
				const data = await readFile(
					config.oidc.client_secret_path,
					'utf8',
				)

				if (data && data.length > 0) {
					secret = data.trim()
				}
			} catch {}
		}
	}

	if (
		(issuer ?? client ?? secret)
		&& !(issuer && client && secret)
	) {
		throw new Error('OIDC configuration is incomplete')
	}

	if (!issuer || !client || !secret) {
		return
	}

	return {
		issuer,
		client,
		secret,
		rootKey,
		disableKeyLogin,
	}
}
