import Dialog from '~/components/Dialog';
import type { PreAuthKey } from '~/types';

interface Props {
	authKey: PreAuthKey;
}

export default function ExpireKey({ authKey }: Props) {
	return (
		<Dialog>
			<Dialog.Button>Expire Key</Dialog.Button>
			<Dialog.Panel method="DELETE" variant="destructive">
				<Dialog.Title>Expire auth key?</Dialog.Title>
				<input type="hidden" name="user" value={authKey.user} />
				<input type="hidden" name="key" value={authKey.key} />
				<Dialog.Text>
					Expiring this authentication key will immediately prevent it from
					being used to authenticate new devices. This action cannot be undone.
				</Dialog.Text>
			</Dialog.Panel>
		</Dialog>
	);
}
