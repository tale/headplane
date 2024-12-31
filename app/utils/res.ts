import { data } from 'react-router';

export function send<T>(payload: T, init?: number | ResponseInit) {
	return data(payload, init);
}
