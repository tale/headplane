import { type FetcherWithComponents } from '@remix-run/react'
import { type Dispatch, type SetStateAction, useState } from 'react'

import Code from '~/components/Code'
import Dialog from '~/components/Dialog'
import TextField from '~/components/TextField'
import { type Machine } from '~/types'

type RenameProperties = {
	readonly machine: Machine;
	readonly fetcher: FetcherWithComponents<unknown>;
	readonly state: [boolean, Dispatch<SetStateAction<boolean>>];
	readonly magic?: string;
}

export default function Rename({ machine, fetcher, state, magic }: RenameProperties) {
	const [name, setName] = useState(machine.givenName)

	return (
		<Dialog>
			<Dialog.Panel control={state}>
				{close => (
					<>
						<Dialog.Title>
							Edit machine name for {machine.givenName}
						</Dialog.Title>
						<Dialog.Text>
							This name is shown in the admin panel, in Tailscale clients,
							and used when generating MagicDNS names.
						</Dialog.Text>
						<fetcher.Form method='POST'>
							<input type='hidden' name='_method' value='rename'/>
							<input type='hidden' name='id' value={machine.id}/>
							<TextField
								label='Machine name'
								placeholder='Machine name'
								name='name'
								state={[name, setName]}
								className='my-2'
							/>
							{magic ? (
								name.length > 0 && name !== machine.givenName ? (
									<p className='text-sm text-gray-500 dark:text-gray-300 leading-tight'>
										This machine will be accessible by the hostname
										{' '}
										<Code className='text-sm'>
											{name.toLowerCase().replaceAll(/\s+/g, '-')}
										</Code>
										{'. '}
										The hostname
										{' '}
										<Code className='text-sm'>
											{machine.givenName}
										</Code>
										{' '}
										will no longer point to this machine.
									</p>
								) : (
									<p className='text-sm text-gray-500 dark:text-gray-300 leading-tight'>
										This machine is accessible by the hostname
										{' '}
										<Code className='text-sm'>
											{machine.givenName}
										</Code>
										.
									</p>
								)
							) : undefined}
							<div className='mt-6 flex justify-end gap-2 mt-6'>
								<Dialog.Action
									variant='cancel'
									onPress={close}
								>
									Cancel
								</Dialog.Action>
								<Dialog.Action
									variant='confirm'
									onPress={close}
								>
									Rename
								</Dialog.Action>
							</div>
						</fetcher.Form>
					</>
				)}
			</Dialog.Panel>
		</Dialog>
	)
}
