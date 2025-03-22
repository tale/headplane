import { DataRef, DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { PersonIcon } from '@primer/octicons-react';
import { useEffect, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useSubmit } from 'react-router';
import { ClientOnly } from 'remix-utils/client-only';
import Attribute from '~/components/Attribute';
import Card from '~/components/Card';
import { ErrorPopup } from '~/components/Error';
import StatusCircle from '~/components/StatusCircle';
import type { LoadContext } from '~/server';
import type { Machine, User } from '~/types';
import cn from '~/utils/cn';
import ManageBanner from './components/manage-banner';
import DeleteUser from './dialogs/delete-user';
import RenameUser from './dialogs/rename-user';
import { userAction } from './user-actions';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	const session = await context.sessions.auth(request);
	const [machines, apiUsers] = await Promise.all([
		context.client.get<{ nodes: Machine[] }>(
			'v1/node',
			session.get('api_key')!,
		),
		context.client.get<{ users: User[] }>('v1/user', session.get('api_key')!),
	]);

	const users = apiUsers.users.map((user) => ({
		...user,
		machines: machines.nodes.filter((machine) => machine.user.id === user.id),
	}));

	let magic: string | undefined;
	if (context.hs.readable()) {
		if (context.hs.c?.dns.magic_dns) {
			magic = context.hs.c.dns.base_domain;
		}
	}

	return {
		oidc: context.config.oidc,
		magic,
		users,
	};
}

export async function action(data: ActionFunctionArgs) {
	return userAction(data);
}

export default function Page() {
	const data = useLoaderData<typeof loader>();
	const [users, setUsers] = useState<UserMachine[]>(data.users);

	// This useEffect is entirely for the purpose of updating the users when the
	// drag and drop changes the machines between users. It's pretty hacky, but
	// the idea is to treat data.users as the source of truth and update the
	// local state when it changes.
	useEffect(() => {
		setUsers(data.users);
	}, [data.users]);

	return (
		<>
			<h1 className="text-2xl font-medium mb-1.5">Users</h1>
			<p className="mb-8 text-md">
				Manage the users in your network and their permissions. Tip: You can
				drag machines between users to change ownership.
			</p>
			<ManageBanner oidc={data.oidc} />
			<ClientOnly fallback={<Users users={users} />}>
				{() => (
					<InteractiveUsers
						users={users}
						setUsers={setUsers}
						magic={data.magic}
					/>
				)}
			</ClientOnly>
		</>
	);
}

type UserMachine = User & { machines: Machine[] };

interface UserProps {
	users: UserMachine[];
	setUsers?: (users: UserMachine[]) => void;
	magic?: string;
}

function Users({ users, magic }: UserProps) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-min">
			{users.map((user) => (
				<UserCard key={user.id} user={user} magic={magic} />
			))}
		</div>
	);
}

function InteractiveUsers({ users, setUsers, magic }: UserProps) {
	const submit = useSubmit();

	return (
		<DndContext
			onDragEnd={(event) => {
				const { over, active } = event;
				if (!over) {
					return;
				}

				// Update the UI optimistically
				const newUsers = new Array<UserMachine>();
				const reference = active.data as DataRef<Machine>;
				if (!reference.current) {
					return;
				}

				// Ignore if the user is unchanged
				if (reference.current.user.name === over.id) {
					return;
				}

				for (const user of users) {
					newUsers.push({
						...user,
						machines:
							over.id === user.name
								? [...user.machines, reference.current]
								: user.machines.filter((m) => m.id !== active.id),
					});
				}

				setUsers?.(newUsers);
				const data = new FormData();
				data.append('action_id', 'change_owner');
				data.append('user_id', over.id.toString());
				data.append('node_id', reference.current.id);

				submit(data, {
					method: 'POST',
				});
			}}
		>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-min">
				{users.map((user) => (
					<UserCard key={user.id} user={user} magic={magic} />
				))}
			</div>
		</DndContext>
	);
}

function MachineChip({ machine }: { readonly machine: Machine }) {
	const { attributes, listeners, setNodeRef, transform } = useDraggable({
		id: machine.id,
		data: machine,
	});

	return (
		<div
			ref={setNodeRef}
			className={cn(
				'flex items-center w-full gap-2 py-1',
				'hover:bg-headplane-50 dark:hover:bg-headplane-950 rounded-xl',
			)}
			style={{
				transform: transform
					? `translate3d(${transform.x.toString()}px, ${transform.y.toString()}px, 0)`
					: undefined,
			}}
			{...listeners}
			{...attributes}
		>
			<StatusCircle isOnline={machine.online} className="px-1 h-4 w-fit" />
			<Attribute
				name={machine.givenName}
				link={`machines/${machine.id}`}
				value={machine.ipAddresses[0]}
			/>
		</div>
	);
}

interface CardProps {
	user: UserMachine;
	magic?: string;
}

function UserCard({ user, magic }: CardProps) {
	const { isOver, setNodeRef } = useDroppable({
		id: user.name,
	});

	return (
		<div ref={setNodeRef}>
			<Card
				variant="flat"
				className={cn(
					'max-w-full w-full overflow-visible h-full',
					isOver ? 'bg-headplane-100 dark:bg-headplane-800' : '',
				)}
			>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<PersonIcon className="w-6 h-6" />
						<span className="text-lg font-mono">{user.name}</span>
					</div>
					<div className="flex items-center gap-2">
						<RenameUser user={user} />
						{user.machines.length === 0 ? (
							<DeleteUser user={user} />
						) : undefined}
					</div>
				</div>
				<div className="mt-4">
					{user.machines.map((machine) => (
						<MachineChip key={machine.id} machine={machine} />
					))}
				</div>
			</Card>
		</div>
	);
}

export function ErrorBoundary() {
	return <ErrorPopup type="embedded" />;
}
