import { ToastQueue } from '@react-stately/toast';
import React from 'react';

const toastQueue = new ToastQueue<React.ReactNode>({
	maxVisibleToasts: 7,
});

export function useToastQueue() {
	return toastQueue;
}

export default function toast(content: React.ReactNode, duration = 3000) {
	return toastQueue.add(content, { timeout: duration });
}
