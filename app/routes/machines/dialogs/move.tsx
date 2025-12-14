import { Key, useState } from 'react';
import Dialog from '~/components/Dialog';
import Select from '~/components/Select';
import type { Machine, User } from '~/types';

interface MoveProps {
	machine: Machine;
	users: User[];
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
}

export default function Move({ machine, users, isOpen, setIsOpen }: MoveProps) {
	const [userId, setUserId] = useState<Key | null>(machine.user.id);

	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Panel isDisabled={userId === machine.user.id}>
				<Dialog.Title>Change the owner of {machine.givenName}</Dialog.Title>
				<Dialog.Text>
					The owner of the machine is the user associated with it.
				</Dialog.Text>
				<input name="action_id" type="hidden" value="reassign" />
				<input name="node_id" type="hidden" value={machine.id} />
				<input name="user_id" type="hidden" value={userId?.toString()} />
				<Select
					defaultSelectedKey={machine.user.id}
					isRequired
					label="Owner"
					name="user"
					onSelectionChange={(key) => {
						setUserId(key);
					}}
					placeholder="Select a user"
				>
					{users.map((user) => (
						<Select.Item key={user.id}>
							{user.name || user.displayName || user.email || user.id}
						</Select.Item>
					))}
				</Select>
			</Dialog.Panel>
		</Dialog>
	);
}
