import { loadContext } from './config/headplane'
import log from './log'

export class HeadscaleError extends Error {
	status: number

	constructor(message: string, status: number) {
		super(message)
		this.name = 'HeadscaleError'
		this.status = status
	}
}

export class FatalError extends Error {
	constructor() {
		super('The Headscale server is not accessible or the supplied API key is invalid')
		this.name = 'FatalError'
	}
}

export async function pull<T>(url: string, key: string) {
	const context = await loadContext()
	const prefix = context.headscaleUrl

	log.debug('APIC', 'GET %s', `${prefix}/api/${url}`)
	const response = await fetch(`${prefix}/api/${url}`, {
		headers: {
			Authorization: `Bearer ${key}`,
		},
	})

	if (!response.ok) {
		log.debug('APIC', 'GET %s failed with status %d', `${prefix}/api/${url}`, response.status)
		throw new HeadscaleError(await response.text(), response.status)
	}

	return (response.json() as Promise<T>)
}

export async function post<T>(url: string, key: string, body?: unknown) {
	const context = await loadContext()
	const prefix = context.headscaleUrl

	log.debug('APIC', 'POST %s', `${prefix}/api/${url}`)
	const response = await fetch(`${prefix}/api/${url}`, {
		method: 'POST',
		body: body ? JSON.stringify(body) : undefined,
		headers: {
			Authorization: `Bearer ${key}`,
		},
	})

	if (!response.ok) {
		log.debug('APIC', 'POST %s failed with status %d', `${prefix}/api/${url}`, response.status)
		throw new HeadscaleError(await response.text(), response.status)
	}

	return (response.json() as Promise<T>)
}

export async function put<T>(url: string, key: string, body?: unknown) {
	const context = await loadContext()
	const prefix = context.headscaleUrl

	log.debug('APIC', 'PUT %s', `${prefix}/api/${url}`)
	const response = await fetch(`${prefix}/api/${url}`, {
		method: 'PUT',
		body: body ? JSON.stringify(body) : undefined,
		headers: {
			Authorization: `Bearer ${key}`,
		},
	})

	if (!response.ok) {
		log.debug('APIC', 'PUT %s failed with status %d', `${prefix}/api/${url}`, response.status)
		throw new HeadscaleError(await response.text(), response.status)
	}

	return (response.json() as Promise<T>)
}

export async function del<T>(url: string, key: string) {
	const context = await loadContext()
	const prefix = context.headscaleUrl

	log.debug('APIC', 'DELETE %s', `${prefix}/api/${url}`)
	const response = await fetch(`${prefix}/api/${url}`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${key}`,
		},
	})

	if (!response.ok) {
		log.debug('APIC', 'DELETE %s failed with status %d', `${prefix}/api/${url}`, response.status)
		throw new HeadscaleError(await response.text(), response.status)
	}

	return (response.json() as Promise<T>)
}
