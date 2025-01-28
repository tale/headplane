import { useState } from 'react';
import { useFetcher } from 'react-router';
import Dialog from '~/components/Dialog';
import Link from '~/components/Link';
import NumberInput from '~/components/NumberInput';
import Select from '~/components/Select';
import Switch from '~/components/Switch';
import type { User } from '~/types';

interface Props {
	users: User[];
}

// TODO: Tags
export default function AddPreAuthKey(data: Props) {
	const [reusable, setReusable] = useState(false);
	const [ephemeral, setEphemeral] = useState(false);

	return (
		<Dialog>
			<Dialog.Button className="my-4">Create pre-auth key</Dialog.Button>
			<Dialog.Panel>
				<Dialog.Title>Generate auth key</Dialog.Title>
				<Dialog.Text className="font-semibold">User</Dialog.Text>
				<Dialog.Text className="text-sm">Attach this key to a user</Dialog.Text>
				<Select
					isRequired
					label="Owner"
					name="user"
					placeholder="Select a user"
				>
					{data.users.map((user) => (
						<Select.Item key={user.name}>{user.name}</Select.Item>
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
				<div className="flex justify-between items-center mt-6">
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
				<div className="flex justify-between items-center mt-6">
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
