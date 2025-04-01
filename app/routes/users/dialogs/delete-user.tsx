import Dialog from '~/components/Dialog';
import { Machine, User } from '~/types';

interface DeleteProps {
	user: User & { machines: Machine[] };
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
}

export default function DeleteUser({ user, isOpen, setIsOpen }: DeleteProps) {
	const name =
		(user.displayName?.length ?? 0) > 0 ? user.displayName : user.name;

	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Panel
				variant={user.machines.length > 0 ? 'unactionable' : 'normal'}
			>
				<Dialog.Title>Delete {name}?</Dialog.Title>
				{user.machines.length > 0 ? (
					<Dialog.Text className="mb-6">
						Users cannot be deleted if they have machines. Please delete or
						re-assign their machines to other users before proceeding.
					</Dialog.Text>
				) : (
					<Dialog.Text className="mb-6">
						Deleted users cannot be recovered.
						{user.provider === 'oidc' && (
							<p className="mt-4 text-sm text-headplane-600 dark:text-headplane-300">
								Since this user is authenticated via an external provider, they
								will be recreated if they sign in again.
							</p>
						)}
					</Dialog.Text>
				)}
				<input type="hidden" name="action_id" value="delete_user" />
				<input type="hidden" name="user_id" value={user.id} />
			</Dialog.Panel>
		</Dialog>
	);
}
