import { env } from '$env/dynamic/public'

export async function pull<T>(url: string, key: string) {
	const prefix = env.PUBLIC_HEADSCALE_URL
	const res = await fetch(`${prefix}/api/${url}`, {
		headers: {
			'Authorization': `Bearer ${key}`
		}
	})

	if (!res.ok) {
		throw new Error(res.statusText)
	}

	return res.json() as Promise<T>
}

export async function post<T>(url: string, key: string, body?: any) {
	const prefix = env.PUBLIC_HEADSCALE_URL

	const res = await fetch(`${prefix}/api/${url}`, {
		method: 'POST',
		body: body ? JSON.stringify(body) : undefined,
		headers: {
			'Authorization': `Bearer ${key}`
		}
	})

	if (!res.ok) {
		throw new Error(await res.text())
	}

	return res.json() as Promise<T>
}

export * from './apiKey'
