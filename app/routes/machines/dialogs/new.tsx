import { Form, useFetcher, Link } from 'react-router';
import { Dispatch, SetStateAction, useState, useEffect } from 'react';
import { PlusIcon, ServerIcon, KeyIcon } from '@primer/octicons-react';
import { cn } from '~/utils/cn';

import Code from '~/components/Code';
import Dialog from '~/components/Dialog';
import TextField from '~/components/TextField';
import Select from '~/components/Select';
import Menu from '~/components/Menu';
import Spinner from '~/components/Spinner';
import { toast } from '~/components/Toaster';
import { Machine, type User } from '~/types';

export interface NewProps {
	server: string;
	users: User[];
}

export default function New(data: NewProps) {
	const fetcher = useFetcher<{ success?: boolean }>();
	const mkeyState = useState(false);
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
	}, [fetcher.data, toasted, mkey]);

	return (
		<>
			<Dialog>
				<Dialog.Panel control={mkeyState}>
					{(close) => (
						<>
							<Dialog.Title>Register Machine Key</Dialog.Title>
							<Dialog.Text className="mb-4">
								The machine key is given when you run{' '}
								<Code isCopyable>
									tailscale up --login-server=
									{data.server}
								</Code>{' '}
								on your device.
							</Dialog.Text>
							<fetcher.Form
								method="POST"
								onSubmit={(e) => {
									fetcher.submit(e.currentTarget);
									close();
								}}
							>
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
								<Dialog.Gutter>
									<Dialog.Action variant="cancel" onPress={close}>
										Cancel
									</Dialog.Action>
									<Dialog.Action
										variant="confirm"
										isDisabled={
											!mkey || !mkey.trim().startsWith('mkey:') || !user
										}
									>
										{fetcher.state === 'idle' ? undefined : (
											<Spinner className="w-3 h-3" />
										)}
										Register
									</Dialog.Action>
								</Dialog.Gutter>
							</fetcher.Form>
						</>
					)}
				</Dialog.Panel>
			</Dialog>
			<Menu>
				<Menu.Button variant="heavy">
					Add Device
				</Menu.Button>
				<Menu.Items>
					<Menu.ItemButton control={mkeyState}>
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
