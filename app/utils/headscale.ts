export class HeadscaleError extends Error {
	status: number

	constructor(message: string, status: number) {
		super(message)
		this.name = 'HeadscaleError'
		this.status = status
	}
}

export class FatalError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'FatalError'
	}
}

/* eslint-disable @typescript-eslint/no-non-null-assertion */
export async function pull<T>(url: string, key: string) {
	try {
		const prefix = process.env.HEADSCALE_URL!
		const response = await fetch(`${prefix}/api/${url}`, {
			headers: {
				Authorization: `Bearer ${key}`
			}
		})

		if (!response.ok) {
			throw new HeadscaleError(await response.text(), response.status)
		}

		return await (response.json() as Promise<T>)
	} catch {
		throw new FatalError('The Headscale server is not reachable')
	}
}

export async function post<T>(url: string, key: string, body?: unknown) {
	try {
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

		return await (response.json() as Promise<T>)
	} catch {
		throw new FatalError('The Headscale server is not reachable')
	}
}

