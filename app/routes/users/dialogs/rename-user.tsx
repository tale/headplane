import { Pencil } from 'lucide-react';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';
import { User } from '~/types';

interface Props {
	user: User;
}

// TODO: Server side validation before submitting
export default function RenameUser({ user }: Props) {
	return (
		<Dialog>
			<Dialog.IconButton label={`Rename ${user.name}`}>
				<Pencil className="p-1" />
			</Dialog.IconButton>
			<Dialog.Panel>
				<Dialog.Title>Rename {user.name}?</Dialog.Title>
				<Dialog.Text className="mb-6">
					Enter a new username for {user.name}. Changing a username will not
					update any ACL policies that may refer to this user by their old
					username.
				</Dialog.Text>
				<input type="hidden" name="action_id" value="rename_user" />
				<input type="hidden" name="user_id" value={user.id} />
				<Input
					isRequired
					name="new_name"
					label="Username"
					placeholder="my-new-name"
					defaultValue={user.name}
				/>
			</Dialog.Panel>
		</Dialog>
	);
}
