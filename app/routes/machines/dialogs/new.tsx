import { Computer, KeySquare } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import Code from '~/components/Code';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';
import Menu from '~/components/Menu';
import Select from '~/components/Select';
import type { User } from '~/types';

export interface NewMachineProps {
	server: string;
	users: User[];
	isDisabled?: boolean;
}

export default function NewMachine(data: NewMachineProps) {
	const [pushDialog, setPushDialog] = useState(false);
	const [mkey, setMkey] = useState('');
	const navigate = useNavigate();

	return (
		<>
			<Dialog isOpen={pushDialog} onOpenChange={setPushDialog}>
				<Dialog.Panel isDisabled={mkey.length < 1}>
					<Dialog.Title>Register Machine Key</Dialog.Title>
					<Dialog.Text className="mb-4">
						The machine key is given when you run{' '}
						<Code isCopyable>tailscale up --login-server={data.server}</Code> on
						your device.
					</Dialog.Text>
					<input type="hidden" name="_method" value="register" />
					<input type="hidden" name="id" value="_" />
					<Input
						isRequired
						label="Machine Key"
						placeholder="AbCd..."
						validationBehavior="native"
						name="mkey"
						onChange={setMkey}
					/>
					<Select
						isRequired
						label="Owner"
						name="user"
						placeholder="Select a user"
					>
						{data.users.map((user) => (
							<Select.Item key={user.id}>{user.name}</Select.Item>
						))}
					</Select>
				</Dialog.Panel>
			</Dialog>
			<Menu isDisabled={data.isDisabled}>
				<Menu.Button variant="heavy">Add Device</Menu.Button>
				<Menu.Panel
					onAction={(key) => {
						if (key === 'register') {
							setPushDialog(true);
							return;
						}

						if (key === 'pre-auth') {
							navigate('/settings/auth-keys');
						}
					}}
				>
					<Menu.Section>
						<Menu.Item key="register" textValue="Register Machine Key">
							<div className="flex items-center gap-x-3">
								<Computer className="w-4" />
								Register Machine Key
							</div>
						</Menu.Item>
						<Menu.Item key="pre-auth" textValue="Generate Pre-auth Key">
							<div className="flex items-center gap-x-3">
								<KeySquare className="w-4" />
								Generate Pre-auth Key
							</div>
						</Menu.Item>
					</Menu.Section>
				</Menu.Panel>
			</Menu>
		</>
	);
}
