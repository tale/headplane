import { Ellipsis } from 'lucide-react';
import { useState } from 'react';
import Menu from '~/components/Menu';
import type { Machine, User } from '~/types';
import cn from '~/utils/cn';
import Delete from '../dialogs/delete-user';
import Reassign from '../dialogs/reassign-user';
import Rename from '../dialogs/rename-user';

interface MenuProps {
	user: User & {
		headplaneRole: string;
		machines: Machine[];
	};
}

type Modal = 'rename' | 'delete' | 'reassign' | null;

export default function UserMenu({ user }: MenuProps) {
	const [modal, setModal] = useState<Modal>(null);
	return (
		<>
			{modal === 'rename' && (
				<Rename
					user={user}
					isOpen={modal === 'rename'}
					setIsOpen={(isOpen) => {
						if (!isOpen) setModal(null);
					}}
				/>
			)}
			{modal === 'delete' && (
				<Delete
					user={user}
					isOpen={modal === 'delete'}
					setIsOpen={(isOpen) => {
						if (!isOpen) setModal(null);
					}}
				/>
			)}
			{modal === 'reassign' && (
				<Reassign
					user={user}
					isOpen={modal === 'reassign'}
					setIsOpen={(isOpen) => {
						if (!isOpen) setModal(null);
					}}
				/>
			)}

			<Menu disabledKeys={user.provider === 'oidc' ? ['rename'] : []}>
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
				<Menu.Panel onAction={(key) => setModal(key as Modal)}>
					<Menu.Section>
						<Menu.Item key="rename">Rename user</Menu.Item>
						<Menu.Item key="reassign">Change role</Menu.Item>
						<Menu.Item key="delete" textValue="Delete">
							<p className="text-red-500 dark:text-red-400">Delete</p>
						</Menu.Item>
					</Menu.Section>
				</Menu.Panel>
			</Menu>
		</>
	);
}
