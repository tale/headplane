import { Dialog } from '@headlessui/react'
import { Form } from '@remix-run/react'
import { useState } from 'react'

type Properties = {
	readonly name: string;
}

export default function Modal({ name }: Properties) {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<>
			<button
				type='button'
				className='rounded-lg px-3 py-2 bg-gray-800 text-white w-fit text-sm'
				onClick={() => {
					setIsOpen(true)
				}}
			>
				Rename Tailnet...
			</button>
			<Dialog
				className='relative z-50'
				open={isOpen} onClose={() => {
					setIsOpen(false)
				}}
			>
				<div className='fixed inset-0 bg-black/30' aria-hidden='true'/>
				<div className='fixed inset-0 flex w-screen items-center justify-center'>
					<Dialog.Panel className='bg-white rounded-lg p-4 w-full max-w-md'>
						<Dialog.Title className='text-lg font-bold'>
							Rename {name}
						</Dialog.Title>
						<Dialog.Description className='text-gray-500 dark:text-gray-400'>
							Keep in mind that changing this can lead to all sorts
							of unexpected behavior and may break existing devices
							in your tailnet.
						</Dialog.Description>
						<Form method='PATCH'>
							<input
								type='text'
								className='border rounded-lg p-2 w-full mt-4'
								placeholder={name}
							/>
							<button
								type='button'
								className='rounded-lg py-2 bg-gray-800 text-white w-full mt-2'
							>
								Rename
							</button>
						</Form>
					</Dialog.Panel>
				</div>
			</Dialog>
		</>
	)
}
