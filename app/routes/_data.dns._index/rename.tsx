import { Dialog } from '@headlessui/react'
import { useState } from 'react'

export default function Modal() {
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
				<div className='fixed inset-0 flex w-screen items-center justify-center p-4'>
					<Dialog.Panel className='bg-white rounded-lg p-4 w-full max-w-md'>
						<Dialog.Title>
							Rename Tailnet
						</Dialog.Title>
						<Dialog.Description>
							<p>
								Enter a new name for your Tailnet.
							</p>
						</Dialog.Description>
						<div className='flex gap-4'>
							<input
								type='text'
								className='border rounded-lg p-2 w-full'
								placeholder='New name'
							/>
							<button
								type='button'
								className='rounded-lg px-3 py-2 bg-gray-800 text-white w-fit text-sm'
							>
								Rename
							</button>
						</div>
					</Dialog.Panel>
				</div>
			</Dialog>
		</>
	)
}
