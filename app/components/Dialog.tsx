/* eslint-disable unicorn/no-keyword-prefix */
import { type Dispatch, type ReactNode, type SetStateAction } from 'react'
import {
	Button as AriaButton,
	Dialog as AriaDialog,
	DialogTrigger,
	Heading as AriaHeading,
	Modal,
	ModalOverlay
} from 'react-aria-components'

import { cn } from '~/utils/cn'

type ButtonProperties = Parameters<typeof AriaButton>[0] & {
	readonly control?: [boolean, Dispatch<SetStateAction<boolean>>];
}

function Button(properties: ButtonProperties) {
	return (
		<AriaButton
			{...properties}
			aria-label='Dialog'
			className={cn(
				'w-fit text-sm rounded-lg px-4 py-2',
				'bg-main-700 dark:bg-main-800 text-white',
				'hover:bg-main-800 dark:hover:bg-main-700',
				properties.isDisabled && 'opacity-50 cursor-not-allowed',
				properties.className
			)}
			// If control is passed, set the state value
			onPress={properties.control ? () => {
				properties.control?.[1](true)
			} : undefined}
		/>
	)
}

type ActionProperties = Parameters<typeof AriaButton>[0] & {
	readonly variant: 'cancel' | 'confirm';
}

function Action(properties: ActionProperties) {
	return (
		<AriaButton
			{...properties}
			type={properties.variant === 'confirm' ? 'submit' : 'button'}
			className={cn(
				'px-4 py-2 rounded-lg',
				properties.isDisabled && 'opacity-50 cursor-not-allowed',
				properties.variant === 'cancel'
					? 'text-ui-700 dark:text-ui-300'
					: 'text-ui-300 dark:text-ui-300',
				properties.variant === 'confirm'
					? 'bg-main-700 dark:bg-main-700 pressed:bg-main-800 dark:pressed:bg-main-800'
					: 'bg-ui-200 dark:bg-ui-800 pressed:bg-ui-300 dark:pressed:bg-ui-700',
				properties.className
			)}
		/>
	)
}

function Title(properties: Parameters<typeof AriaHeading>[0]) {
	return (
		<AriaHeading
			{...properties}
			slot='title'
			className={cn(
				'text-lg font-semibold leading-6 mb-5',
				properties.className
			)}
		/>
	)
}

function Text(properties: React.HTMLProps<HTMLParagraphElement>) {
	return (
		<p
			{...properties}
			className={cn(
				'text-base leading-6 my-0',
				properties.className
			)}
		/>
	)
}

type PanelProperties = {
	readonly children: (close: () => void) => ReactNode;
	readonly control?: [boolean, Dispatch<SetStateAction<boolean>>];
	readonly className?: string;
}

function Panel({ children, control, className }: PanelProperties) {
	return (
		<ModalOverlay
			aria-hidden='true'
			className={cn(
				'fixed inset-0 h-screen w-screen z-50 bg-black/30',
				'flex items-center justify-center dark:bg-black/70',
				'entering:animate-in exiting:animate-out',
				'entering:fade-in entering:duration-200 entering:ease-out',
				'exiting:fade-out exiting:duration-100 exiting:ease-in',
				className
			)}
			isOpen={control ? control[0] : undefined}
			onOpenChange={control ? control[1] : undefined}
		>
			<Modal
				className={cn(
					'w-full max-w-md overflow-hidden rounded-xl p-4',
					'bg-ui-50 dark:bg-ui-900 shadow-lg',
					'entering:animate-in exiting:animate-out',
					'dark:border dark:border-ui-700',
					'entering:zoom-in-95 entering:ease-out entering:duration-200',
					'exiting:zoom-out-95 exiting:ease-in exiting:duration-100'
				)}
			>
				<AriaDialog role='alertdialog' className='outline-none relative'>
					{({ close }) => children(close)}
				</AriaDialog>
			</Modal>
		</ModalOverlay>
	)
}

type DialogProperties = {
	readonly children: ReactNode;
	readonly control?: [boolean, Dispatch<SetStateAction<boolean>>];
}

function Dialog({ children, control }: DialogProperties) {
	if (control) {
		return children
	}

	return (
		<DialogTrigger>
			{children}
		</DialogTrigger>
	)
}

export default Object.assign(Dialog, { Button, Title, Text, Panel, Action })
