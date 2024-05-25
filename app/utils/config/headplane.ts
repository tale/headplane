// Handle the configuration loading for headplane.
// Functionally only used for all sorts of sanity checks across headplane.
//
// Around the codebase, this is referred to as the context

import { access, constants, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { parse } from 'yaml'

import { HeadscaleConfig, loadConfig } from './headscale'

export interface HeadplaneContext {
	headscaleUrl: string
	cookieSecret: string

	config: {
		read: boolean
		write: boolean
	}

	acl: {
		read: boolean
		write: boolean
	}

	docker?: {
		url: string
		sock: boolean
		container: string
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

	let config: HeadscaleConfig | undefined
	try {
		config = await loadConfig()
	} catch {}

	const path = resolve(process.env.CONFIG_FILE ?? '/etc/headscale/config.yaml')

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
		config: await checkConfig(path, config),
		acl: await checkAcl(config),
		docker: await checkDocker(),
		oidc: await checkOidc(config),
	}

	return context
}

export async function loadAcl() {
	let path = process.env.ACL_FILE
	if (!path) {
		try {
			const config = await loadConfig()
			path = config.acl_policy_path
		} catch {}
	}

	if (!path) {
		return { data: '', type: 'json' }
	}

	const data = await readFile(path, 'utf8')

	// Naive check for YAML over JSON
	// This is because JSON.parse doesn't support comments
	try {
		parse(data)
		return { data, type: 'yaml' }
	} catch {
		return { data, type: 'json' }
	}
}

export async function patchAcl(data: string) {
	let path = process.env.ACL_FILE
	if (!path) {
		try {
			const config = await loadConfig()
			path = config.acl_policy_path
		} catch {}
	}

	if (!path) {
		throw new Error('No ACL file defined')
	}

	await writeFile(path, data, 'utf8')
}

async function checkConfig(path: string, config?: HeadscaleConfig) {
	let write = false
	try {
		await access(path, constants.W_OK)
		write = true
	} catch {}

	return {
		read: config ? true : false,
		write,
	}
}

async function checkAcl(config?: HeadscaleConfig) {
	let path = process.env.ACL_FILE
	if (!path && config) {
		path = config.acl_policy_path
	}

	let read = false
	let write = false
	if (path) {
		try {
			await access(path, constants.R_OK)
			read = true
		} catch {}

		try {
			await access(path, constants.W_OK)
			write = true
		} catch {}
	}

	return {
		read,
		write,
	}
}

async function checkDocker() {
	const path = process.env.DOCKER_SOCK ?? 'unix:///var/run/docker.sock'

	let url: URL | undefined
	try {
		url = new URL(path)
	} catch {
		return
	}

	// The API is available as an HTTP endpoint
	if (url.protocol === 'tcp:') {
		url.protocol = 'http:'
	}

	// Check if the socket is accessible
	if (url.protocol === 'unix:') {
		try {
			await access(path, constants.R_OK)
		} catch {
			return
		}
	}

	if (url.protocol === 'http:') {
		try {
			await fetch(new URL('/v1.30/version', url).href)
		} catch {
			return
		}
	}

	if (url.protocol !== 'http:' && url.protocol !== 'unix:') {
		return
	}

	if (!process.env.HEADSCALE_CONTAINER) {
		return
	}

	return {
		url: url.href,
		sock: url.protocol === 'unix:',
		container: process.env.HEADSCALE_CONTAINER,
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