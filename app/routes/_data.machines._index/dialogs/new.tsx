import { Form, useFetcher, Link } from '@remix-run/react'
import { Dispatch, SetStateAction, useState, useEffect } from 'react'
import { PlusIcon, ServerIcon, KeyIcon } from '@primer/octicons-react'
import { cn } from '~/utils/cn'

import Code from '~/components/Code'
import Dialog from '~/components/Dialog'
import TextField from '~/components/TextField'
import Select from '~/components/Select'
import Menu from '~/components/Menu'
import Spinner from '~/components/Spinner'
import { toast } from '~/components/Toaster'
import { Machine, User } from '~/types'

export interface NewProps {
	server: string
	users: User[]
}

export default function New(data: NewProps) {
	const fetcher = useFetcher()
	const mkeyState = useState(false)
	const [mkey, setMkey] = useState('')
	const [user, setUser] = useState('')
	const [toasted, setToasted] = useState(false)

	useEffect(() => {
		if (!fetcher.data || toasted) {
			return
		}

		if (fetcher.data.success) {
			toast('Registered new machine')
		} else {
			toast('Failed to register machine due to an invalid key')
		}

		setToasted(true)
	}, [fetcher.data, toasted, mkey])

	return (
		<>
			<Dialog>
				<Dialog.Panel control={mkeyState}>
					{close => (
						<>
							<Dialog.Title>
								Register Machine Key
							</Dialog.Title>
							<Dialog.Text className='mb-4'>
								The machine key is given when you run
								{' '}
								<Code>
									tailscale up --login-server=
								</Code>
								<Code>
									{data.server}
								</Code>
								{' '}
								on your device.
							</Dialog.Text>
							<fetcher.Form method="POST" onSubmit={e => {
								fetcher.submit(e.currentTarget)
								close()
							}}>
								<input type="hidden" name="_method" value="register" />
								<input type="hidden" name="id" value="_" />
								<TextField
									label='Machine Key'
									placeholder='mkey:ff.....'
									name="mkey"
									state={[mkey, setMkey]}
									className='my-2 font-mono'
								/>
								<Select
									label="Owner"
									name="user"
									placeholder="Select a user"
									state={[user, setUser]}
								>
									{data.users.map(user => (
										<Select.Item key={user.id} id={user.name}>
											{user.name}
										</Select.Item>
									))}
								</Select>
								<div className='mt-6 flex justify-end gap-2 mt-6'>
									<Dialog.Action
										variant="cancel"
										onPress={close}
									>
										Cancel
									</Dialog.Action>
									<Dialog.Action
										variant="confirm"
										isDisabled={!mkey || !mkey.trim().startsWith('mkey:') || !user}
									>
										{fetcher.state === 'idle'
											? undefined
											: (
												<Spinner className="w-3 h-3" />
												)}
										Register
									</Dialog.Action>
								</div>
							</fetcher.Form>
						</>
					)}
				</Dialog.Panel>
			</Dialog>
			<Menu>
				<Menu.Button
					className={cn(
						'w-fit text-sm rounded-lg px-4 py-2',
						'bg-main-700 dark:bg-main-800 text-white',
						'hover:bg-main-800 dark:hover:bg-main-700',
					)}
				>
					Add Device
				</Menu.Button>
				<Menu.Items>
					<Menu.ItemButton control={mkeyState}>
						<ServerIcon className='w-4 h-4 mr-2'/>
						Register Machine Key
					</Menu.ItemButton>
					<Menu.ItemButton>
						<Link to="/settings/auth-keys">
							<KeyIcon className='w-4 h-4 mr-2'/>
							Generate Pre-auth Key
						</Link>
					</Menu.ItemButton>
				</Menu.Items>
			</Menu>
		</>
	)
}
