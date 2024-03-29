export class HeadscaleError extends Error {
	status: number

	constructor(message: string, status: number) {
		super(message)
		this.name = 'HeadscaleError'
		this.status = status
	}
}

/* eslint-disable @typescript-eslint/no-non-null-assertion */
export async function pull<T>(url: string, key: string) {
	const prefix = process.env.HEADSCALE_URL!
	const response = await fetch(`${prefix}/api/${url}`, {
		headers: {
			Authorization: `Bearer ${key}`
		}
	})

	if (!response.ok) {
		throw new HeadscaleError(await response.text(), response.status)
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
		throw new HeadscaleError(await response.text(), response.status)
	}

	return response.json() as Promise<T>
}

