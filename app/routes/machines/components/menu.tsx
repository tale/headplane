import { KebabHorizontalIcon } from '@primer/octicons-react';
import React, { useState } from 'react';
import MenuComponent from '~/components/Menu';
import type { Machine, Route, User } from '~/types';
import { cn } from '~/utils/cn';

import Delete from '../dialogs/delete';
import Expire from '../dialogs/expire';
import Move from '../dialogs/move';
import Rename from '../dialogs/rename';
import Routes from '../dialogs/routes';
import Tags from '../dialogs/tags';

interface MenuProps {
	machine: Machine;
	routes: Route[];
	users: User[];
	magic?: string;
	buttonChild?: React.ReactNode;
}

type Modal = 'rename' | 'expire' | 'remove' | 'routes' | 'move' | 'tags' | null;

export default function Menu({
	machine,
	routes,
	magic,
	users,
	buttonChild,
}: MenuProps) {
	const [modal, setModal] = useState<Modal>(null);

	const expired =
		machine.expiry === '0001-01-01 00:00:00' ||
		machine.expiry === '0001-01-01T00:00:00Z' ||
		machine.expiry === null
			? false
			: new Date(machine.expiry).getTime() < Date.now();

	return (
		<>
			{modal === 'remove' && (
				<Delete
					machine={machine}
					isOpen={modal === 'remove'}
					setIsOpen={(isOpen) => {
						if (!isOpen) setModal(null);
					}}
				/>
			)}
			{modal === 'move' && (
				<Move
					machine={machine}
					users={users}
					isOpen={modal === 'move'}
					setIsOpen={(isOpen) => {
						if (!isOpen) setModal(null);
					}}
				/>
			)}
			{modal === 'rename' && (
				<Rename
					machine={machine}
					magic={magic}
					isOpen={modal === 'rename'}
					setIsOpen={(isOpen) => {
						if (!isOpen) setModal(null);
					}}
				/>
			)}
			{modal === 'routes' && (
				<Routes
					machine={machine}
					routes={routes}
					isOpen={modal === 'routes'}
					setIsOpen={(isOpen) => {
						if (!isOpen) setModal(null);
					}}
				/>
			)}
			{modal === 'tags' && (
				<Tags
					machine={machine}
					isOpen={modal === 'tags'}
					setIsOpen={(isOpen) => {
						if (!isOpen) setModal(null);
					}}
				/>
			)}
			{expired && modal === 'expire' ? undefined : (
				<Expire
					machine={machine}
					isOpen={modal === 'expire'}
					setIsOpen={(isOpen) => {
						if (!isOpen) setModal(null);
					}}
				/>
			)}

			<MenuComponent>
				{buttonChild ?? (
					<MenuComponent.Button
						className={cn(
							'flex items-center justify-center',
							'border border-transparent rounded-lg py-0.5 w-10',
							'group-hover:border-gray-200 dark:group-hover:border-zinc-700',
						)}
					>
						<KebabHorizontalIcon className="w-5" />
					</MenuComponent.Button>
				)}
				<MenuComponent.Items>
					<MenuComponent.ItemButton onPress={() => setModal('rename')}>
						Edit machine name
					</MenuComponent.ItemButton>
					<MenuComponent.ItemButton onPress={() => setModal('routes')}>
						Edit route settings
					</MenuComponent.ItemButton>
					<MenuComponent.ItemButton onPress={() => setModal('tags')}>
						Edit ACL tags
					</MenuComponent.ItemButton>
					<MenuComponent.ItemButton onPress={() => setModal('move')}>
						Change owner
					</MenuComponent.ItemButton>
					{expired ? undefined : (
						<MenuComponent.ItemButton onPress={() => setModal('expire')}>
							Expire
						</MenuComponent.ItemButton>
					)}
					<MenuComponent.ItemButton
						className="text-red-500 dark:text-red-400"
						onPress={() => setModal('remove')}
					>
						Remove
					</MenuComponent.ItemButton>
				</MenuComponent.Items>
			</MenuComponent>
		</>
	);
}
