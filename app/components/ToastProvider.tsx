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
import { ToastData } from '~/utils/toast';

interface ToastProps extends AriaToastProps<ToastData> {
	state: ToastState<ToastData>;
}

function Toast({ state, ...props }: ToastProps) {
	const ref = useRef<HTMLDivElement | null>(null);
	const { toastProps, contentProps, titleProps, closeButtonProps } = useToast(
		props,
		state,
		ref,
	);

	const { content, type } = props.toast.content;
	const isError = type === 'error';
	const isSuccess = type === 'success';

	return (
		<div
			{...toastProps}
			className={cn(
				'flex items-center justify-between gap-x-3 pl-4 pr-3',
				'shadow-lg dark:shadow-md rounded-xl py-3',
				'max-w-[50vw] whitespace-pre-wrap break-words',
				!isError &&
					!isSuccess &&
					'bg-headplane-900 dark:bg-headplane-950 text-white',
				isError && 'bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100',
				isSuccess &&
					'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100',
			)}
			ref={ref}
		>
			<div {...contentProps} className="flex flex-col gap-2 flex-1">
				<div {...titleProps}>{content}</div>
			</div>
			<IconButton
				{...closeButtonProps}
				className={cn(
					'bg-transparent hover:bg-black/10',
					!isError &&
						!isSuccess &&
						'hover:bg-headplane-700 dark:hover:bg-headplane-800',
				)}
				label="Close"
			>
				<X className="p-1" />
			</IconButton>
		</div>
	);
}

interface ToastRegionProps extends AriaToastRegionProps {
	state: ToastState<ToastData>;
}

function ToastRegion({ state, ...props }: ToastRegionProps) {
	const ref = useRef<HTMLDivElement | null>(null);
	const { regionProps } = useToastRegion(props, state, ref);

	return (
		<div
			{...regionProps}
			className={cn('fixed bottom-20 right-4', 'flex flex-col gap-4', 'z-50')}
			ref={ref}
		>
			{state.visibleToasts.map((toast) => (
				<Toast key={toast.key} state={state} toast={toast} />
			))}
		</div>
	);
}

export interface ToastProviderProps extends AriaToastRegionProps {
	queue: ToastQueue<ToastData>;
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
