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
	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Panel>
				<Dialog.Title>Change the owner of {machine.givenName}</Dialog.Title>
				<Dialog.Text>
					The owner of the machine is the user associated with it.
				</Dialog.Text>
				<input type="hidden" name="action_id" value="reassign" />
				<input type="hidden" name="node_id" value={machine.id} />
				<Select
					label="Owner"
					name="user"
					placeholder="Select a user"
					defaultSelectedKey={machine.user.id}
				>
					{users.map((user) => (
						<Select.Item key={user.id}>{user.name}</Select.Item>
					))}
				</Select>
			</Dialog.Panel>
		</Dialog>
	);
}
