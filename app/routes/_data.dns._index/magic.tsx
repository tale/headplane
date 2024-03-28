import { Dialog } from '@headlessui/react'
import { useFetcher } from '@remix-run/react'
import clsx from 'clsx'
import { useState } from 'react'

type Properties = {
	readonly isEnabled: boolean;
	readonly baseDomain: string;
}

export default function Modal({ isEnabled, baseDomain }: Properties) {
	const [isOpen, setIsOpen] = useState(false)
	const fetcher = useFetcher()

	return (
		<>
			<button
				type='button'
				className='rounded-lg px-3 py-2 bg-gray-800 text-white w-fit text-sm'
				onClick={() => {
					setIsOpen(true)
				}}
			>
				{isEnabled ? 'Disable' : 'Enable'} Magic DNS
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
							{isEnabled ? 'Disable' : 'Enable'} Magic DNS
						</Dialog.Title>
						<Dialog.Description className='text-gray-500 dark:text-gray-400'>
							Devices will no longer be accessible via your tailnet domain.
							The search domain will also be disabled.
						</Dialog.Description>
						<button
							type='submit'
							className={clsx(
								'rounded-lg py-2 bg-gray-800 text-white w-full mt-12',
								isEnabled ? 'bg-red-800' : 'bg-gray-800'
							)}
							onClick={() => {
								fetcher.submit({
									// eslint-disable-next-line @typescript-eslint/naming-convention
									'dns_config.magic_dns': !isEnabled
								}, {
									method: 'PATCH',
									encType: 'application/json'
								})

								setIsOpen(false)
							}}
						>
							{isEnabled ? 'Disable' : 'Enable'}
						</button>
					</Dialog.Panel>
				</div>
			</Dialog>
		</>
	)
}
