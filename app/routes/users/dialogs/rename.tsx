import { Pencil } from 'lucide-react';
import { useState } from 'react';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';

interface Props {
	username: string;
}

// TODO: Server side validation before submitting
export default function Rename({ username }: Props) {
	const [newName, setNewName] = useState(username);

	return (
		<Dialog>
			<Dialog.IconButton label={`Rename ${username}`}>
				<Pencil className="p-1" />
			</Dialog.IconButton>
			<Dialog.Panel>
				<Dialog.Title>Rename {username}?</Dialog.Title>
				<Dialog.Text className="mb-8">
					Enter a new username for {username}. Changing a username will not
					update any ACL policies that may refer to this user by their old
					username.
				</Dialog.Text>
				<input type="hidden" name="_method" value="rename" />
				<input type="hidden" name="old" value={username} />
				<Input
					isRequired
					name="new"
					label="Username"
					placeholder="my-new-name"
				/>
			</Dialog.Panel>
		</Dialog>
	);
}
