import { ToastQueue } from '@react-stately/toast';
import React from 'react';

export interface ToastData {
	content: React.ReactNode;
	type: 'success' | 'error' | 'default';
}

const toastQueue = new ToastQueue<ToastData>({
	maxVisibleToasts: 7,
});

export function useToastQueue() {
	return toastQueue;
}

export type ToastOptions = {
	type?: 'success' | 'error' | 'default';
	timeout?: number;
};

export default function toast(
	content: React.ReactNode,
	options?: ToastOptions | number,
) {
	const timeout = typeof options === 'number' ? options : options?.timeout;
	const type = typeof options === 'object' ? options.type : 'default';

	return toastQueue.add(
		{ content, type: type ?? 'default' },
		{ timeout: timeout ?? 3000 },
	);
}
