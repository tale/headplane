import { XMarkIcon } from '@heroicons/react/24/outline'
import { type AriaToastProps, useToast, useToastRegion } from '@react-aria/toast'
import { ToastQueue, type ToastState, useToastQueue } from '@react-stately/toast'
import { type ReactNode, useRef } from 'react'
import { Button } from 'react-aria-components'
import { createPortal } from 'react-dom'
import { ClientOnly } from 'remix-utils/client-only'

import { cn } from '~/utils/cn'

type ToastProperties = AriaToastProps<ReactNode> & {
	readonly state: ToastState<ReactNode>;
}

function Toast({ state, ...properties }: ToastProperties) {
	const reference = useRef(null)
	const { toastProps, titleProps, closeButtonProps } = useToast(properties, state, reference)

	return (
		<div
			{...toastProps}
			ref={reference}
			className={cn(
				'bg-main-700 dark:bg-main-800 rounded-lg',
				'text-main-100 dark:text-main-200 z-50',
				'border border-main-600 dark:border-main-700',
				'flex items-center justify-between p-3 pl-4 w-80'
			)}
		>
			<div {...titleProps}>{properties.toast.content}</div>
			<Button
				{...closeButtonProps}
				className={cn(
					'outline-none rounded-full p-1',
					'hover:bg-main-600 dark:hover:bg-main-700'
				)}
			>
				<XMarkIcon className='w-4 h-4'/>
			</Button>
		</div>
	)
}

const toasts = new ToastQueue<ReactNode>({
	maxVisibleToasts: 5
})

export function toast(text: string) {
	return toasts.add(text, { timeout: 5000 })
}

export function Toaster() {
	const reference = useRef(null)
	const state = useToastQueue(toasts)
	const { regionProps } = useToastRegion({}, state, reference)

	return (
		<ClientOnly>
			{() => createPortal(
				state.visibleToasts.length >= 0 ? (
					<div
						className={cn(
							'fixed bottom-4 right-4',
							'flex flex-col gap-4'
						)}
						{...regionProps}
						ref={reference}
					>
						{state.visibleToasts.map(toast => (
							<Toast key={toast.key} toast={toast} state={state}/>
						))}
					</div>
				) : undefined,
				document.body
			)}
		</ClientOnly>
	)
}

