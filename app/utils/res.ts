import { data } from 'react-router';

export function send<T>(payload: T, init?: number | ResponseInit) {
	return data(payload, init);
}

export function send401<T>(payload: T) {
	return data(payload, { status: 401 });
}
