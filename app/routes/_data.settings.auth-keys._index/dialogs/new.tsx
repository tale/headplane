import { RepoForkedIcon } from '@primer/octicons-react'
import { useFetcher } from '@remix-run/react'
import { useState } from 'react'

import Dialog from '~/components/Dialog'
import TextField from '~/components/TextField'
import NumberField from '~/components/NumberField'
import Tooltip from '~/components/Tooltip'
import Select from '~/components/Select'
import Switch from '~/components/Switch'
import Link from '~/components/Link'
import Spinner from '~/components/Spinner'

import { cn } from '~/utils/cn'
import { User } from '~/types'

interface Props {
	users: User[]
}

// TODO: Tags
export default function AddPreAuthKey(data: Props) {
	const fetcher = useFetcher()
	const [user, setUser] = useState('')
	const [reusable, setReusable] = useState(false)
	const [ephemeral, setEphemeral] = useState(false)
	const [aclTags, setAclTags] = useState([])
	const [expiry, setExpiry] = useState(90)

	return (
		<Dialog>
			<Dialog.Button className="my-4">
				Create pre-auth key
			</Dialog.Button>
			<Dialog.Panel>
				{close => (
					<>
						<Dialog.Title>
							Generate auth key
						</Dialog.Title>
						<fetcher.Form method="POST" onSubmit={e => {
							fetcher.submit(e.currentTarget)
							close()
						}}>
							<Dialog.Text className="font-semibold">
								User
							</Dialog.Text>
							<Dialog.Text className="text-sm">
								Attach this key to a user
							</Dialog.Text>
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
							<Dialog.Text className="font-semibold mt-4">
								Key Expiration
							</Dialog.Text>
							<Dialog.Text className="text-sm">
								Set this key to expire between 1 and 90 days.
							</Dialog.Text>
							<NumberField
								label="Expiry"
								name="expiry"
								minValue={1}
								maxValue={90}
								state={[expiry, setExpiry]}
								formatOptions={{
									style: 'unit',
									unit: 'day',
									unitDisplay: 'short',
								}}
							/>
							<div className="flex justify-between items-center mt-6">
								<div>
									<Dialog.Text className="font-semibold">
										Reusable
									</Dialog.Text>
									<Dialog.Text className="text-sm">
										Use this key to authenticate more than one device.
									</Dialog.Text>
								</div>
								<Switch
									label="Reusable"
									name="reusable"
									defaultSelected={reusable}
									onChange={() => { setReusable(!reusable) }}
								/>
							</div>
							<input type="hidden" name="reusable" value={reusable} />
							<div className="flex justify-between items-center mt-6">
								<div>
									<Dialog.Text className="font-semibold">
										Ephemeral
									</Dialog.Text>
									<Dialog.Text className="text-sm">
										Devices authenticated with this key will
										be automatically removed once they go offline.
										{' '}
										<Link
											to="https://tailscale.com/kb/1111/ephemeral-nodes"
											name="Tailscale Ephemeral Nodes Documentation"
										>
											Learn more
										</Link>
									</Dialog.Text>
								</div>
								<Switch
									label="Ephemeral"
									name="ephemeral"
									defaultSelected={ephemeral}
									onChange={() => {
										setEphemeral(!ephemeral)
									}}
								/>
							</div>
							<input type="hidden" name="ephemeral" value={ephemeral} />
							<div className="mt-6 flex justify-end gap-2 mt-6">
								<Dialog.Action
									variant="cancel"
									onPress={close}
								>
									Cancel
								</Dialog.Action>
								<Dialog.Action
									variant="confirm"
									onPress={close}
									isDisabled={!user || !expiry}
								>
									{fetcher.state === 'idle'
										? undefined
										: (
											<Spinner className="w-3 h-3" />
											)}
									Generate
								</Dialog.Action>
							</div>
						</fetcher.Form>
					</>
				)}
			</Dialog.Panel>
		</Dialog>
	)
}
