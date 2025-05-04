import { Cog, Ellipsis } from 'lucide-react';
import { useState } from 'react';
import Menu from '~/components/Menu';
import type { User } from '~/types';
import cn from '~/utils/cn';
import { PopulatedNode } from '~/utils/node-info';
import Delete from '../dialogs/delete';
import Expire from '../dialogs/expire';
import Move from '../dialogs/move';
import Rename from '../dialogs/rename';
import Routes from '../dialogs/routes';
import Tags from '../dialogs/tags';

interface MenuProps {
	node: PopulatedNode;
	users: User[];
	magic?: string;
	isFullButton?: boolean;
	isDisabled?: boolean;
}

type Modal = 'rename' | 'expire' | 'remove' | 'routes' | 'move' | 'tags' | null;

export default function MachineMenu({
	node,
	magic,
	users,
	isFullButton,
	isDisabled,
}: MenuProps) {
	const [modal, setModal] = useState<Modal>(null);
	return (
		<>
			{modal === 'remove' && (
				<Delete
					machine={node}
					isOpen={modal === 'remove'}
					setIsOpen={(isOpen) => {
						if (!isOpen) setModal(null);
					}}
				/>
			)}
			{modal === 'move' && (
				<Move
					machine={node}
					users={users}
					isOpen={modal === 'move'}
					setIsOpen={(isOpen) => {
						if (!isOpen) setModal(null);
					}}
				/>
			)}
			{modal === 'rename' && (
				<Rename
					machine={node}
					magic={magic}
					isOpen={modal === 'rename'}
					setIsOpen={(isOpen) => {
						if (!isOpen) setModal(null);
					}}
				/>
			)}
			{modal === 'routes' && (
				<Routes
					node={node}
					isOpen={modal === 'routes'}
					setIsOpen={(isOpen) => {
						if (!isOpen) setModal(null);
					}}
				/>
			)}
			{modal === 'tags' && (
				<Tags
					machine={node}
					isOpen={modal === 'tags'}
					setIsOpen={(isOpen) => {
						if (!isOpen) setModal(null);
					}}
				/>
			)}
			{node.expired && modal === 'expire' ? undefined : (
				<Expire
					machine={node}
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
				<Menu.Panel
					onAction={(key) => setModal(key as Modal)}
					disabledKeys={node.expired ? ['expire'] : []}
				>
					<Menu.Section>
						<Menu.Item key="rename">Edit machine name</Menu.Item>
						<Menu.Item key="routes">Edit route settings</Menu.Item>
						<Menu.Item key="tags">Edit ACL tags</Menu.Item>
						<Menu.Item key="move">Change owner</Menu.Item>
					</Menu.Section>
					<Menu.Section>
						<Menu.Item key="expire" textValue="Expire">
							<p className="text-red-500 dark:text-red-400">Expire</p>
						</Menu.Item>
						<Menu.Item key="remove" textValue="Remove">
							<p className="text-red-500 dark:text-red-400">Remove</p>
						</Menu.Item>
					</Menu.Section>
				</Menu.Panel>
			</Menu>
		</>
	);
}
