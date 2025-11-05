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
				<input name="action_id" type="hidden" value="expire_preauthkey" />
				<input name="user_id" type="hidden" value={user.id} />
				<input name="key" type="hidden" value={authKey.key} />
				<Dialog.Text>
					Expiring this authentication key will immediately prevent it from
					being used to authenticate new devices. This action cannot be undone.
				</Dialog.Text>
			</Dialog.Panel>
		</Dialog>
	);
}
