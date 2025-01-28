import {
	AriaToastProps,
	AriaToastRegionProps,
	useToast,
	useToastRegion,
} from '@react-aria/toast';
import { ToastQueue, ToastState, useToastQueue } from '@react-stately/toast';
import { X } from 'lucide-react';
import React, { useRef } from 'react';
import IconButton from '~/components/IconButton';
import cn from '~/utils/cn';

interface ToastProps extends AriaToastProps<React.ReactNode> {
	state: ToastState<React.ReactNode>;
}

function Toast({ state, ...props }: ToastProps) {
	const ref = useRef<HTMLDivElement | null>(null);
	const { toastProps, contentProps, titleProps, closeButtonProps } = useToast(
		props,
		state,
		ref,
	);

	return (
		<div
			{...toastProps}
			ref={ref}
			className={cn(
				'flex items-center justify-between gap-x-3 pl-4 pr-3',
				'text-white shadow-lg dark:shadow-md rounded-xl py-3',
				'bg-headplane-900 dark:bg-headplane-950',
			)}
		>
			<div {...contentProps} className="flex flex-col gap-2">
				<div {...titleProps}>{props.toast.content}</div>
			</div>
			<IconButton
				{...closeButtonProps}
				label="Close"
				className={cn(
					'bg-transparent hover:bg-headplane-700',
					'dark:bg-transparent dark:hover:bg-headplane-800',
				)}
			>
				<X className="p-1" />
			</IconButton>
		</div>
	);
}

interface ToastRegionProps extends AriaToastRegionProps {
	state: ToastState<React.ReactNode>;
}

function ToastRegion({ state, ...props }: ToastRegionProps) {
	const ref = useRef<HTMLDivElement | null>(null);
	const { regionProps } = useToastRegion(props, state, ref);

	return (
		<div
			{...regionProps}
			ref={ref}
			className={cn('fixed bottom-20 right-4', 'flex flex-col gap-4')}
		>
			{state.visibleToasts.map((toast) => (
				<Toast key={toast.key} toast={toast} state={state} />
			))}
		</div>
	);
}

export interface ToastProviderProps extends AriaToastRegionProps {
	queue: ToastQueue<React.ReactNode>;
}

export default function ToastProvider({ queue, ...props }: ToastProviderProps) {
	const state = useToastQueue(queue);

	return (
		<>
			{state.visibleToasts.length > 0 && (
				<ToastRegion {...props} state={state} />
			)}
		</>
	);
}
