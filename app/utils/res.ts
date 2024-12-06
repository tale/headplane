import { data } from '@remix-run/node'

export function send<T>(payload: T, init?: number | ResponseInit) {
	return data(payload, init)
}
