import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { Fragment, type ReactNode, type SetStateAction, useState } from 'react'

import Button from './Button'

type HookParameters = {
	title: string;
	description?: string;
	buttonText?: string;
	variant?: 'danger' | 'confirm';
	children?: ReactNode;

	// Optional because the button submits
	onConfirm?: () => void | Promise<void>;
}

type Properties = {
	readonly isOpen: boolean;
	readonly setIsOpen: (value: SetStateAction<boolean>) => void;
	readonly parameters: HookParameters;
}

export default function useModal(properties: HookParameters) {
	const [isOpen, setIsOpen] = useState(false)
	return {
		Modal: (
			<Modal
				isOpen={isOpen}
				setIsOpen={setIsOpen}
				parameters={properties}
			/>
		),

		open: () => {
			setIsOpen(true)
		},

		close: () => {
			setIsOpen(false)
		}
	}
}

function Modal({ parameters, isOpen, setIsOpen }: Properties) {
	return (
		<Transition
			show={isOpen}
			as={Fragment}
		>
			<Dialog
				as='div'
				className='relative z-50'
				onClose={() => {
					setIsOpen(false)
				}}
			>
				<Transition.Child
					enter='ease-out duration-100'
					enterFrom='opacity-0'
					enterTo='opacity-100'
					leave='ease-in duration-75'
					leaveFrom='opacity-100'
					leaveTo='opacity-0'
					as={Fragment}
				>
					<div className='fixed inset-0 bg-black/30' aria-hidden='true'/>
				</Transition.Child>
				<div className='fixed inset-0 flex w-screen items-center justify-center'>
					<Transition.Child
						enter='transition ease-out duration-100'
						enterFrom='transform opacity-0 scale-95'
						enterTo='transform opacity-100 scale-100'
						leave='transition ease-in duration-75'
						leaveFrom='transform opacity-100 scale-100'
						leaveTo='transform opacity-0 scale-95'
						as={Fragment}
					>
						<Dialog.Panel className={clsx(
							'rounded-lg p-4 w-full max-w-md',
							'bg-white dark:bg-black relative',
							'border border-gray-200 dark:border-zinc-800'
						)}
						>
							<XMarkIcon
								className={clsx(
									'absolute top-3 right-3 rounded-lg p-1.5',
									'w-8 h-8 text-gray-500 dark:text-gray-400',
									'hover:bg-gray-100 dark:hover:bg-zinc-800'
								)}
								onClick={() => {
									setIsOpen(false)
								}}
							/>
							<Dialog.Title className='text-xl font-bold'>
								{parameters.title}
							</Dialog.Title>
							{parameters.description ? (
								<Dialog.Description className='text-gray-500 dark:text-gray-400 mt-1'>
									{parameters.description}
								</Dialog.Description>
							) : undefined}
							{parameters.children ? (
								<div className='mt-12 w-full'>
									{parameters.children}
								</div>
							) : undefined}
							<Button
								variant='emphasized'
								type='submit'
								className={clsx(
									'w-full',
									parameters.children ? 'mt-4' : 'mt-12',
									parameters.variant === 'danger'
										? 'bg-red-800 dark:bg-red-500 focus:ring-red-500 dark:focus:ring-red-500'
										: ''
								)}
								onClick={async () => {
									if (parameters.onConfirm) {
										await parameters.onConfirm()
									}

									setIsOpen(false)
								}}
							>
								{parameters.buttonText ?? 'Confirm'}
							</Button>
						</Dialog.Panel>
					</Transition.Child>
				</div>
			</Dialog>
		</Transition>
	)
}
