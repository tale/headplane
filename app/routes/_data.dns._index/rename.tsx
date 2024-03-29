/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable unicorn/no-keyword-prefix */
import { Dialog } from '@headlessui/react'
import { useFetcher } from '@remix-run/react'
import { useState } from 'react'

import Button from '~/components/Button'
import Code from '~/components/Code'
import Input from '~/components/Input'

type Properties = {
	readonly name: string;
}

export default function Modal({ name }: Properties) {
	const [isOpen, setIsOpen] = useState(false)
	const [newName, setNewName] = useState(name)
	const fetcher = useFetcher()

	return (
		<div className='flex flex-col w-2/3'>
			<h1 className='text-2xl font-medium mb-4'>Tailnet Name</h1>
			<p className='text-gray-700 dark:text-gray-300'>
				This is the base domain name of your Tailnet.
				Devices are accessible at
				{' '}
				<Code>
					[device].[user].{name}
				</Code>
				{' '}
				when Magic DNS is enabled.
			</p>
			<Input
				readOnly
				className='font-mono text-sm my-4'
				type='text'
				value={name}
				onFocus={event => {
					event.target.select()
				}}
			/>
			<Button
				variant='emphasized'
				className='text-sm w-fit'
				onClick={() => {
					setIsOpen(true)
				}}
			>
				Rename Tailnet...
			</Button>
			<Dialog
				className='relative z-50'
				open={isOpen} onClose={() => {
					setIsOpen(false)
				}}
			>
				<div className='fixed inset-0 bg-black/30' aria-hidden='true'/>
				<div className='fixed inset-0 flex w-screen items-center justify-center'>
					<Dialog.Panel className='bg-white rounded-lg p-4 w-full max-w-md dark:bg-zinc-800'>
						<Dialog.Title className='text-lg font-bold'>
							Rename {name}
						</Dialog.Title>
						<Dialog.Description className='text-gray-500 dark:text-gray-400'>
							Keep in mind that changing this can lead to all sorts
							of unexpected behavior and may break existing devices
							in your tailnet.
						</Dialog.Description>
						<Input
							type='text'
							className='font-mono mt-4'
							value={newName}
							onChange={event => {
								setNewName(event.target.value)
							}}
						/>
						<button
							type='submit'
							className='rounded-lg py-2 bg-gray-800 text-white w-full mt-2'
							onClick={() => {
								fetcher.submit({
									'dns_config.base_domain': newName
								}, {
									method: 'PATCH',
									encType: 'application/json'
								})

								setIsOpen(false)
								setNewName(name)
							}}
						>
							Rename
						</button>
					</Dialog.Panel>
				</div>
			</Dialog>
		</div>
	)
}
