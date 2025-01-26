import { KeyIcon, ServerIcon } from '@primer/octicons-react';
import { useEffect, useState } from 'react';
import { Link, useFetcher } from 'react-router';

import Code from '~/components/Code';
import Dialog from '~/components/Dialog';
import Menu from '~/components/Menu';
import Select from '~/components/Select';
import Spinner from '~/components/Spinner';
import TextField from '~/components/TextField';
import { toast } from '~/components/Toaster';
import type { User } from '~/types';

export interface NewProps {
	server: string;
	users: User[];
}

export default function New(data: NewProps) {
	const fetcher = useFetcher<{ success?: boolean }>();
	const [pushDialog, setPushDialog] = useState(false);
	const [mkey, setMkey] = useState('');
	const [user, setUser] = useState('');
	const [toasted, setToasted] = useState(false);

	useEffect(() => {
		if (!fetcher.data || toasted) {
			return;
		}

		if (fetcher.data.success) {
			toast('Registered new machine');
		} else {
			toast('Failed to register machine due to an invalid key');
		}

		setToasted(true);
	}, [fetcher.data, toasted]);

	return (
		<>
			<Dialog isOpen={pushDialog} onOpenChange={setPushDialog}>
				<Dialog.Panel
					isDisabled={!mkey || !mkey.trim().startsWith('mkey:') || !user}
				>
					<Dialog.Title>Register Machine Key</Dialog.Title>
					<Dialog.Text className="mb-4">
						The machine key is given when you run{' '}
						<Code isCopyable>
							tailscale up --login-server=
							{data.server}
						</Code>{' '}
						on your device.
					</Dialog.Text>
					<input type="hidden" name="_method" value="register" />
					<input type="hidden" name="id" value="_" />
					<TextField
						label="Machine Key"
						placeholder="mkey:ff....."
						name="mkey"
						state={[mkey, setMkey]}
						className="my-2 font-mono"
					/>
					<Select
						label="Owner"
						name="user"
						placeholder="Select a user"
						state={[user, setUser]}
					>
						{data.users.map((user) => (
							<Select.Item key={user.id} id={user.name}>
								{user.name}
							</Select.Item>
						))}
					</Select>
				</Dialog.Panel>
			</Dialog>
			<Menu>
				<Menu.Button variant="heavy">Add Device</Menu.Button>
				<Menu.Items>
					<Menu.ItemButton onPress={() => setPushDialog(true)}>
						<ServerIcon className="w-4 h-4 mr-2" />
						Register Machine Key
					</Menu.ItemButton>
					<Menu.ItemButton>
						<Link to="/settings/auth-keys">
							<KeyIcon className="w-4 h-4 mr-2" />
							Generate Pre-auth Key
						</Link>
					</Menu.ItemButton>
				</Menu.Items>
			</Menu>
		</>
	);
}
