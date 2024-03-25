/* eslint-disable @typescript-eslint/no-non-null-assertion */
export async function pull<T>(url: string, key: string) {
	const prefix = process.env.HEADSCALE_URL!
	const response = await fetch(`${prefix}/api/${url}`, {
		headers: {
			Authorization: `Bearer ${key}`
		}
	})

	if (!response.ok) {
		throw new Error(response.statusText)
	}

	return response.json() as Promise<T>
}

export async function post<T>(url: string, key: string, body?: unknown) {
	const prefix = process.env.HEADSCALE_URL!
	const response = await fetch(`${prefix}/api/${url}`, {
		method: 'POST',
		body: body ? JSON.stringify(body) : undefined,
		headers: {
			Authorization: `Bearer ${key}`
		}
	})

	if (!response.ok) {
		throw new Error(await response.text())
	}

	return response.json() as Promise<T>
}

