import { env } from '$env/dynamic/public'

export async function pull<T>(url: string) {
	const prefix = env.PUBLIC_HEADSCALE_URL
	const key = env.PUBLIC_API_KEY

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
