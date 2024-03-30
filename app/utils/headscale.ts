import { getContext } from './config'

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
		super('The Headscale server is not accessible or the API_KEY is invalid.')
		this.name = 'FatalError'
	}
}

export async function pull<T>(url: string, key: string) {
	const context = await getContext()
	const prefix = context.headscaleUrl
	const response = await fetch(`${prefix}/api/${url}`, {
		headers: {
			Authorization: `Bearer ${key}`
		}
	})

	if (!response.ok) {
		throw new HeadscaleError(await response.text(), response.status)
	}

	return (response.json() as Promise<T>)
}

export async function post<T>(url: string, key: string, body?: unknown) {
	const context = await getContext()
	const prefix = context.headscaleUrl
	const response = await fetch(`${prefix}/api/${url}`, {
		method: 'POST',
		body: body ? JSON.stringify(body) : undefined,
		headers: {
			Authorization: `Bearer ${key}`
		}
	})

	if (!response.ok) {
		throw new HeadscaleError(await response.text(), response.status)
	}

	return (response.json() as Promise<T>)
}

export async function del<T>(url: string, key: string) {
	const context = await getContext()
	const prefix = context.headscaleUrl
	const response = await fetch(`${prefix}/api/${url}`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${key}`
		}
	})

	if (!response.ok) {
		throw new HeadscaleError(await response.text(), response.status)
	}

	return (response.json() as Promise<T>)
}
