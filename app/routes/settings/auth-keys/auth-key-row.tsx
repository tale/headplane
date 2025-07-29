import Attribute from '~/components/Attribute';
import Button from '~/components/Button';
import Code from '~/components/Code';
import type { PreAuthKey, User } from '~/types';
import toast from '~/utils/toast';
import ExpireAuthKey from './dialogs/expire-auth-key';

interface Props {
	authKey: PreAuthKey;
	user: User;
	url: string;
}

export default function AuthKeyRow({ authKey, user, url }: Props) {
	const createdAt = new Date(authKey.createdAt).toLocaleString();
	const expiration = new Date(authKey.expiration).toLocaleString();

	return (
		<div className="w-full">
			<Attribute name="Key" value={authKey.key} isCopyable />
			<Attribute name="User" value={user.name || user.displayName} isCopyable />
			<Attribute name="Reusable" value={authKey.reusable ? 'Yes' : 'No'} />
			<Attribute name="Ephemeral" value={authKey.ephemeral ? 'Yes' : 'No'} />
			<Attribute name="Used" value={authKey.used ? 'Yes' : 'No'} />
			<Attribute name="Created" value={createdAt} />
			<Attribute name="Expiration" value={expiration} />
			<p className="mb-1 mt-4">
				To use this key, run the following command on your device:
			</p>
			<Code className="text-sm">
				tailscale up --login-server={url} --authkey {authKey.key}
			</Code>
			<div suppressHydrationWarning className="flex gap-4 items-center">
				{(authKey.used && !authKey.reusable) ||
				new Date(authKey.expiration) < new Date() ? undefined : (
					<ExpireAuthKey authKey={authKey} user={user} />
				)}
				<Button
					variant="light"
					className="my-4"
					onPress={async () => {
						await navigator.clipboard.writeText(
							`tailscale up --login-server=${url} --authkey ${authKey.key}`,
						);

						toast('Copied command to clipboard');
					}}
				>
					Copy Tailscale Command
				</Button>
			</div>
		</div>
	);
}
