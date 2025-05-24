import Dialog from '~/components/Dialog';
import type { PreAuthKey, User } from '~/types';

interface ExpireAuthKeyProps {
	authKey: PreAuthKey;
	user: User;
}

export default function ExpireAuthKey({ authKey, user }: ExpireAuthKeyProps) {
	return (
		<Dialog>
			<Dialog.Button variant="heavy">Expire Key</Dialog.Button>
			<Dialog.Panel variant="destructive">
				<Dialog.Title>Expire auth key?</Dialog.Title>
				<input type="hidden" name="action_id" value="expire_preauthkey" />
				<input type="hidden" name="user_id" value={user.id} />
				<input type="hidden" name="key" value={authKey.key} />
				<Dialog.Text>
					Expiring this authentication key will immediately prevent it from
					being used to authenticate new devices. This action cannot be undone.
				</Dialog.Text>
			</Dialog.Panel>
		</Dialog>
	);
}
