import { X } from 'lucide-react';
import Dialog from '~/components/Dialog';
import { User } from '~/types';

interface Props {
	user: User;
}

// TODO: Warn that OIDC users will be recreated on next login
export default function DeleteUser({ user }: Props) {
	const name =
		(user.displayName?.length ?? 0) > 0 ? user.displayName : user.name;

	return (
		<Dialog>
			<Dialog.IconButton label={`Delete ${name}`}>
				<X className="p-0.5" />
			</Dialog.IconButton>
			<Dialog.Panel>
				<Dialog.Title>Delete {name}?</Dialog.Title>
				<Dialog.Text className="mb-6">
					Are you sure you want to delete {name}? A deleted user cannot be
					recovered.
				</Dialog.Text>
				<input type="hidden" name="action_id" value="delete_user" />
				<input type="hidden" name="user_id" value={user.id} />
			</Dialog.Panel>
		</Dialog>
	);
}
