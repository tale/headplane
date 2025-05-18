import { Key, useState } from 'react';
import { useFetcher } from 'react-router';
import Dialog from '~/components/Dialog';
import Link from '~/components/Link';
import NumberInput from '~/components/NumberInput';
import Select from '~/components/Select';
import Switch from '~/components/Switch';
import type { User } from '~/types';

interface AddAuthKeyProps {
	users: User[];
}

// TODO: Tags
export default function AddAuthKey(data: AddAuthKeyProps) {
	const [reusable, setReusable] = useState(false);
	const [ephemeral, setEphemeral] = useState(false);
	const [userId, setUserId] = useState<Key | null>(data.users[0]?.id);

	return (
		<Dialog>
			<Dialog.Button className="my-4">Create pre-auth key</Dialog.Button>
			<Dialog.Panel>
				<Dialog.Title>Generate auth key</Dialog.Title>
				<input type="hidden" name="action_id" value="add_preauthkey" />
				<input type="hidden" name="user_id" value={userId?.toString()} />
				<Select
					isRequired
					label="User"
					name="user"
					placeholder="Select a user"
					description="This is the user machines will belong to when they authenticate."
					className="mb-2"
					onSelectionChange={(value) => {
						setUserId(value);
					}}
				>
					{data.users.map((user) => (
						<Select.Item key={user.id}>{user.name}</Select.Item>
					))}
				</Select>
				<NumberInput
					isRequired
					name="expiry"
					label="Key Expiration"
					description="Set this key to expire after a certain number of days."
					minValue={1}
					maxValue={365_000} // 1000 years
					defaultValue={90}
					formatOptions={{
						style: 'unit',
						unit: 'day',
						unitDisplay: 'short',
					}}
				/>
				<div className="flex justify-between items-center gap-2 mt-6">
					<div>
						<Dialog.Text className="font-semibold">Reusable</Dialog.Text>
						<Dialog.Text className="text-sm">
							Use this key to authenticate more than one device.
						</Dialog.Text>
					</div>
					<Switch
						label="Reusable"
						name="reusable"
						defaultSelected={reusable}
						onChange={() => {
							setReusable(!reusable);
						}}
					/>
				</div>
				<input type="hidden" name="reusable" value={reusable.toString()} />
				<div className="flex justify-between items-center gap-2 mt-6">
					<div>
						<Dialog.Text className="font-semibold">Ephemeral</Dialog.Text>
						<Dialog.Text className="text-sm">
							Devices authenticated with this key will be automatically removed
							once they go offline.{' '}
							<Link
								to="https://tailscale.com/kb/1111/ephemeral-nodes"
								name="Tailscale Ephemeral Nodes Documentation"
							>
								Learn more
							</Link>
						</Dialog.Text>
					</div>
					<Switch
						label="Ephemeral"
						name="ephemeral"
						defaultSelected={ephemeral}
						onChange={() => {
							setEphemeral(!ephemeral);
						}}
					/>
				</div>
				<input type="hidden" name="ephemeral" value={ephemeral.toString()} />
			</Dialog.Panel>
		</Dialog>
	);
}
