/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { type DataRef, DndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import { PersonIcon } from '@primer/octicons-react'
import { type ActionFunctionArgs, json, type LoaderFunctionArgs } from '@remix-run/node'
import { useActionData, useLoaderData, useSubmit } from '@remix-run/react'
import { useEffect, useState } from 'react'
import { ClientOnly } from 'remix-utils/client-only'

import Attribute from '~/components/Attribute'
import Card from '~/components/Card'
import StatusCircle from '~/components/StatusCircle'
import { toast } from '~/components/Toaster'
import { type Machine, type User } from '~/types'
import { cn } from '~/utils/cn'
import { loadContext } from '~/utils/config/headplane'
import { loadConfig } from '~/utils/config/headscale'
import { del, post, pull } from '~/utils/headscale'
import { getSession } from '~/utils/sessions'
import { useLiveData } from '~/utils/useLiveData'

import Auth from './auth'
import Oidc from './oidc'
import Remove from './remove'
import Rename from './rename'

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))

	const [machines, apiUsers] = await Promise.all([
		pull<{ nodes: Machine[] }>('v1/node', session.get('hsApiKey')!),
		pull<{ users: User[] }>('v1/user', session.get('hsApiKey')!),
	])

	const users = apiUsers.users.map(user => ({
		...user,
		machines: machines.nodes.filter(machine => machine.user.id === user.id),
	}))

	const context = await loadContext()
	let magic: string | undefined

	if (context.config.read) {
		const config = await loadConfig()
		if (config.dns.magic_dns) {
			magic = config.dns.base_domain
		}
	}

	return {
		oidc: context.oidc,
		magic,
		users,
	}
}

export async function action({ request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	if (!session.has('hsApiKey')) {
		return json({ message: 'Unauthorized' }, {
			status: 401,
		})
	}

	const data = await request.formData()
	if (!data.has('_method')) {
		return json({ message: 'No method provided' }, {
			status: 400,
		})
	}

	const method = String(data.get('_method'))

	switch (method) {
		case 'create': {
			if (!data.has('username')) {
				return json({ message: 'No name provided' }, {
					status: 400,
				})
			}

			const username = String(data.get('username'))
			await post('v1/user', session.get('hsApiKey')!, {
				name: username,
			})

			return json({ message: `User ${username} created` })
		}

		case 'delete': {
			if (!data.has('username')) {
				return json({ message: 'No name provided' }, {
					status: 400,
				})
			}

			const username = String(data.get('username'))
			await del(`v1/user/${username}`, session.get('hsApiKey')!)
			return json({ message: `User ${username} deleted` })
		}

		case 'rename': {
			if (!data.has('old') || !data.has('new')) {
				return json({ message: 'No old or new name provided' }, {
					status: 400,
				})
			}

			const old = String(data.get('old'))
			const newName = String(data.get('new'))
			await post(`v1/user/${old}/rename/${newName}`, session.get('hsApiKey')!)
			return json({ message: `User ${old} renamed to ${newName}` })
		}

		case 'move': {
			if (!data.has('id') || !data.has('to') || !data.has('name')) {
				return json({ message: 'No ID or destination provided' }, {
					status: 400,
				})
			}

			const id = String(data.get('id'))
			const to = String(data.get('to'))
			const name = String(data.get('name'))

			try {
				await post(`v1/node/${id}/user?user=${to}`, session.get('hsApiKey')!)
				return json({ message: `Moved ${name} to ${to}` })
			} catch {
				return json({ message: `Failed to move ${name} to ${to}` }, {
					status: 500,
				})
			}
		}

		default: {
			return json({ message: 'Invalid method' }, {
				status: 400,
			})
		}
	}
}

export default function Page() {
	const data = useLoaderData<typeof loader>()
	const [users, setUsers] = useState(data.users)
	const actionData = useActionData<typeof action>()
	useLiveData({ interval: 3000 })

	useEffect(() => {
		if (!actionData) {
			return
		}

		toast(actionData.message)
		if (actionData.message.startsWith('Failed')) {
			setUsers(data.users)
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [actionData])

	useEffect(() => {
		setUsers(data.users)
	}, [data.users])

	return (
		<>
			<h1 className="text-2xl font-medium mb-1.5">
				Users
			</h1>
			<p className="mb-8 text-md">
				Manage the users in your network and their permissions.
				Tip: You can drag machines between users to change ownership.
			</p>
			{data.oidc
				? (
					<Oidc
						oidc={data.oidc}
						magic={data.magic}
					/>
					)
				: (
					<Auth magic={data.magic} />
					)}
			<ClientOnly fallback={
				<Users users={users} />
			}
			>
				{() => (
					<InteractiveUsers
						users={users}
						setUsers={setUsers}
						magic={data.magic}
					/>
				)}
			</ClientOnly>
		</>
	)
}

type UserMachine = User & { machines: Machine[] }

interface UserProps {
	users: UserMachine[]
	setUsers?: (users: UserMachine[]) => void
	magic?: string
}

function Users({ users, magic }: UserProps) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-min">
			{users.map(user => (
				<UserCard
					key={user.id}
					user={user}
					magic={magic}
				/>
			))}
		</div>
	)
}

function InteractiveUsers({ users, setUsers, magic }: UserProps) {
	const submit = useSubmit()

	return (
		<DndContext onDragEnd={(event) => {
			const { over, active } = event
			if (!over) {
				return
			}

			// Update the UI optimistically
			const newUsers = new Array<UserMachine>()
			const reference = active.data as DataRef<Machine>
			if (!reference.current) {
				return
			}

			// Ignore if the user is unchanged
			if (reference.current.user.name === over.id) {
				return
			}

			for (const user of users) {
				newUsers.push({
					...user,
					machines: over.id === user.name
						? [...user.machines, reference.current]
						: user.machines.filter(m => m.id !== active.id),
				})
			}

			setUsers?.(newUsers)
			const data = new FormData()
			data.append('_method', 'move')
			data.append('id', active.id.toString())
			data.append('to', over.id.toString())
			data.append('name', reference.current.givenName)

			submit(data, {
				method: 'POST',
			})
		}}
		>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-min">
				{users.map(user => (
					<UserCard
						key={user.id}
						user={user}
						magic={magic}
					/>
				))}
			</div>
		</DndContext>
	)
}

function MachineChip({ machine }: { readonly machine: Machine }) {
	const { attributes, listeners, setNodeRef, transform } = useDraggable({
		id: machine.id,
		data: machine,
	})

	return (
		<div
			ref={setNodeRef}
			className={cn(
				'flex items-center w-full gap-2 py-1',
				'hover:bg-ui-100 dark:hover:bg-ui-800 rounded-lg',
			)}
			style={{
				transform: transform
					? `translate3d(${transform.x.toString()}px, ${transform.y.toString()}px, 0)`
					: undefined,
			}}
			{...listeners}
			{...attributes}
		>
			<StatusCircle isOnline={machine.online} className="w-4 h-4 px-1 w-fit" />
			<Attribute
				name={machine.givenName}
				value={machine.ipAddresses[0]}
			/>
		</div>
	)
}

interface CardProps {
	user: UserMachine
	magic?: string
}

function UserCard({ user, magic }: CardProps) {
	const { isOver, setNodeRef } = useDroppable({
		id: user.name,
	})

	return (
		<div ref={setNodeRef}>
			<Card
				variant="flat"
				className={cn(
					'max-w-full w-full overflow-visible h-full',
					isOver ? 'bg-ui-100 dark:bg-ui-800' : '',
				)}
			>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<PersonIcon className="w-6 h-6" />
						<span className="text-lg font-mono">
							{user.name}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<Rename username={user.name} magic={magic} />
						{user.machines.length === 0
							? (
								<Remove username={user.name} />
								)
							: undefined}
					</div>
				</div>
				<div className="mt-4">
					{user.machines.map(machine => (
						<MachineChip key={machine.id} machine={machine} />
					))}
				</div>
			</Card>
		</div>
	)
}
