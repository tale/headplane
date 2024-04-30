/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable unicorn/no-keyword-prefix */
import { useFetcher } from '@remix-run/react'
import { useState } from 'react'

import Button from '~/components/Button'
import Code from '~/components/Code'
import Input from '~/components/Input'
import useModal from '~/components/Modal'
import Spinner from '~/components/Spinner'

type Properties = {
	readonly name: string;
	// eslint-disable-next-line react/boolean-prop-naming
	readonly disabled?: boolean;
}

export default function Modal({ name, disabled }: Properties) {
	const [newName, setNewName] = useState(name)
	const fetcher = useFetcher()
	const { Modal, open } = useModal({
		title: 'Rename Tailnet',
		description: 'Keep in mind that changing this can lead to all sorts of unexpected behavior and may break existing devices in your tailnet.',
		buttonText: 'Rename',
		children: (
			<Input
				type='text'
				className='font-mono mt-4'
				value={newName}
				onChange={event => {
					setNewName(event.target.value)
				}}
			/>
		),
		onConfirm: () => {
			fetcher.submit({
				'dns_config.base_domain': newName
			}, {
				method: 'PATCH',
				encType: 'application/json'
			})
		}
	})

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
				className='font-mono text-sm my-4 w-1/2'
				type='text'
				value={name}
				onFocus={event => {
					event.target.select()
				}}
			/>
			<Button
				variant='emphasized'
				className='text-sm w-fit'
				disabled={disabled}
				onClick={() => {
					open()
				}}
			>
				{fetcher.state === 'idle' ? undefined : (
					<Spinner className='w-3 h-3'/>
				)}
				Rename Tailnet...
			</Button>
			{Modal}
		</div>
	)
}
