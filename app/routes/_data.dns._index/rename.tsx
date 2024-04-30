/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable unicorn/no-keyword-prefix */
import { useFetcher } from '@remix-run/react'
import { useState } from 'react'

import Code from '~/components/Code'
import Dialog from '~/components/Dialog'
import Input from '~/components/Input'
import Spinner from '~/components/Spinner'
import TextField from '~/components/TextField'
import { cn } from '~/utils/cn'

type Properties = {
	readonly name: string;
	// eslint-disable-next-line react/boolean-prop-naming
	readonly disabled?: boolean;
}

export default function Modal({ name, disabled }: Properties) {
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
				className='font-mono text-sm my-4 w-1/2'
				type='text'
				value={name}
				onFocus={event => {
					event.target.select()
				}}
			/>
			<Dialog>
				<Dialog.Button
					isDisabled={disabled}
					className={cn(
						'w-fit text-sm rounded-lg px-4 py-2',
						'bg-gray-700 dark:bg-gray-800 text-white',
						disabled && 'opacity-50 cursor-not-allowed'
					)}
				>
					{fetcher.state === 'idle' ? undefined : (
						<Spinner className='w-3 h-3'/>
					)}
					Rename Tailnet
				</Dialog.Button>
				<Dialog.Panel>
					{close => (
						<>
							<Dialog.Title>
								Rename Tailnet
							</Dialog.Title>
							<Dialog.Text>
								Keep in mind that changing this can lead to all sorts of unexpected behavior and may break existing devices in your tailnet.
							</Dialog.Text>
							<TextField
								label='Tailnet name'
								placeholder='ts.net'
								state={[newName, setNewName]}
								className='my-2'
							/>
							<div className='mt-6 flex justify-end gap-2 mt-6'>
								<Dialog.Action
									variant='cancel'
									onPress={close}
								>
									Cancel
								</Dialog.Action>
								<Dialog.Action
									variant='confirm'
									onPress={() => {
										fetcher.submit({
											'dns_config.base_domain': newName
										}, {
											method: 'PATCH',
											encType: 'application/json'
										})

										close()
									}}
								>
									Rename
								</Dialog.Action>
							</div>
						</>
					)}
				</Dialog.Panel>
			</Dialog>
		</div>
	)
}
