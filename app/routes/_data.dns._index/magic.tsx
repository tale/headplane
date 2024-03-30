import { Dialog } from '@headlessui/react'
import { useFetcher } from '@remix-run/react'
import clsx from 'clsx'
import { useState } from 'react'

import Button from '~/components/Button'

type Properties = {
	readonly isEnabled: boolean;
	// eslint-disable-next-line react/boolean-prop-naming
	readonly disabled?: boolean;
}

export default function Modal({ isEnabled, disabled }: Properties) {
	const [isOpen, setIsOpen] = useState(false)
	const fetcher = useFetcher()

	return (
		<>
			<Button
				variant='emphasized'
				className='w-fit text-sm'
				disabled={disabled}
				onClick={() => {
					setIsOpen(true)
				}}
			>
				{isEnabled ? 'Disable' : 'Enable'} Magic DNS
			</Button>
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
						<Button
							variant='emphasized'
							type='submit'
							className={clsx(
								'w-full mt-12',
								isEnabled ? 'bg-red-800 dark:bg-red-500' : ''
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
						</Button>
					</Dialog.Panel>
				</div>
			</Dialog>
		</>
	)
}
