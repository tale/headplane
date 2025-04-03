import { data } from 'react-router';

export function send<T>(payload: T, init?: number | ResponseInit) {
	return data(payload, init);
}

export function send401<T>(payload: T) {
	return data(payload, { status: 401 });
}

export function data400(message: string) {
	return data(
		{
			success: false,
			message,
		},
		{ status: 400 },
	);
}

export function data403(message: string) {
	return data(
		{
			success: false,
			message,
		},
		{ status: 403 },
	);
}

export function data404(message: string) {
	return data(
		{
			success: false,
			message,
		},
		{ status: 404 },
	);
}
