import { Cog, Ellipsis } from 'lucide-react';
import { useState } from 'react';
import Menu from '~/components/Menu';
import type { Machine, Route, User } from '~/types';
import cn from '~/utils/cn';
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
	isFullButton?: boolean;
	isDisabled?: boolean;
}

type Modal = 'rename' | 'expire' | 'remove' | 'routes' | 'move' | 'tags' | null;

export default function MachineMenu({
	machine,
	routes,
	magic,
	users,
	isFullButton,
	isDisabled,
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

			<Menu isDisabled={isDisabled}>
				{isFullButton ? (
					<Menu.Button className="flex items-center gap-x-2">
						<Cog className="h-5" />
						<p>Machine Settings</p>
					</Menu.Button>
				) : (
					<Menu.IconButton
						label="Machine Options"
						className={cn(
							'py-0.5 w-10 bg-transparent border-transparent',
							'border group-hover:border-headplane-200',
							'dark:group-hover:border-headplane-700',
						)}
					>
						<Ellipsis className="h-5" />
					</Menu.IconButton>
				)}
				<Menu.Panel onAction={(key) => setModal(key as Modal)}>
					<Menu.Section>
						<Menu.Item key="rename">Edit machine name</Menu.Item>
						<Menu.Item key="routes">Edit route settings</Menu.Item>
						<Menu.Item key="tags">Edit ACL tags</Menu.Item>
						<Menu.Item key="move">Change owner</Menu.Item>
					</Menu.Section>
					<Menu.Section>
						{expired ? (
							<></>
						) : (
							<Menu.Item key="expire" textValue="Expire">
								<p className="text-red-500 dark:text-red-400">Expire</p>
							</Menu.Item>
						)}
						<Menu.Item key="remove" textValue="Remove">
							<p className="text-red-500 dark:text-red-400">Remove</p>
						</Menu.Item>
					</Menu.Section>
				</Menu.Panel>
			</Menu>
		</>
	);
}
