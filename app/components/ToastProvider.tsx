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

	const content = props.toast.content;
	let variant: 'default' | 'error' | 'warning' = 'default';

	const contentElement = React.isValidElement(content)
		? (content as React.ReactElement<{ 'data-variant'?: string }>)
		: null;

	if (
		contentElement &&
		typeof contentElement.props['data-variant'] === 'string'
	) {
		if (contentElement.props['data-variant'] === 'error') {
			variant = 'error';
		} else if (contentElement.props['data-variant'] === 'warning') {
			variant = 'warning';
		}
	}

	const bgClass =
		variant === 'error'
			? 'bg-red-600 dark:bg-red-700'
			: variant === 'warning'
				? 'bg-amber-500 dark:bg-amber-600'
				: 'bg-headplane-900 dark:bg-headplane-950';

	return (
		<div
			{...toastProps}
			className={cn(
				'flex items-center justify-between gap-x-3 pl-4 pr-3',
				'text-white shadow-lg dark:shadow-md rounded-xl py-3',
				bgClass,
			)}
			ref={ref}
		>
			<div {...contentProps} className="flex flex-col gap-2">
				<div {...titleProps}>{props.toast.content}</div>
			</div>
			<IconButton
				{...closeButtonProps}
				className={cn(
					'bg-transparent hover:bg-headplane-700',
					'dark:bg-transparent dark:hover:bg-headplane-800',
				)}
				label="Close"
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
			className={cn('fixed bottom-20 right-4', 'flex flex-col gap-4')}
			ref={ref}
		>
			{state.visibleToasts.map((toast) => (
				<Toast key={toast.key} state={state} toast={toast} />
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
