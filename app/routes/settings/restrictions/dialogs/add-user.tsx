import { useMemo, useState } from 'react';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';

interface AddUserProps {
	users: string[];
	isDisabled?: boolean;
}

export default function AddUser({ users, isDisabled }: AddUserProps) {
	const [user, setUser] = useState('');

	const isInvalid = useMemo(() => {
		if (!user || user.trim().length === 0) {
			// Empty user is invalid, but no error shown
			return false;
		}

		if (users.includes(user.trim())) {
			return true;
		}
	}, [user, users]);

	return (
		<Dialog>
			<Dialog.Button isDisabled={isDisabled}>Add user</Dialog.Button>
			<Dialog.Panel>
				<Dialog.Title>Add user</Dialog.Title>
				<Dialog.Text className="mb-4">
					Add this user to a list of allowed users that can authenticate with
					Headscale via OIDC.
				</Dialog.Text>
				<input name="action_id" type="hidden" value="add_user" />
				<Input
					description="The user to allow for OIDC authentication."
					isInvalid={user.trim().length === 0 || isInvalid}
					isRequired
					label="User"
					name="user"
					onChange={setUser}
					placeholder="john_doe"
				/>
				{isInvalid && (
					<p className="text-red-500 text-sm mt-2">
						The user you entered already exists in the list of allowed users.
					</p>
				)}
			</Dialog.Panel>
		</Dialog>
	);
}
