import { Key, useState } from 'react';
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
				<input name="action_id" type="hidden" value="add_preauthkey" />
				<input name="user_id" type="hidden" value={userId?.toString()} />
				<Select
					className="mb-2"
					description="This is the user machines will belong to when they authenticate."
					isRequired
					label="User"
					name="user"
					onSelectionChange={(value) => {
						setUserId(value);
					}}
					placeholder="Select a user"
				>
					{data.users.map((user) => (
						<Select.Item key={user.id}>
							{user.name || user.displayName || user.email || user.id}
						</Select.Item>
					))}
				</Select>
				<NumberInput
					defaultValue={90}
					description="Set this key to expire after a certain number of days."
					formatOptions={{
						style: 'unit',
						unit: 'day',
						unitDisplay: 'short',
					}}
					isRequired
					label="Key Expiration"
					maxValue={365_000} // 1000 years
					minValue={1}
					name="expiry"
				/>
				<div className="flex justify-between items-center gap-2 mt-6">
					<div>
						<Dialog.Text className="font-semibold">Reusable</Dialog.Text>
						<Dialog.Text className="text-sm">
							Use this key to authenticate more than one device.
						</Dialog.Text>
					</div>
					<Switch
						defaultSelected={reusable}
						label="Reusable"
						name="reusable"
						onChange={() => {
							setReusable(!reusable);
						}}
					/>
				</div>
				<input name="reusable" type="hidden" value={reusable.toString()} />
				<div className="flex justify-between items-center gap-2 mt-6">
					<div>
						<Dialog.Text className="font-semibold">Ephemeral</Dialog.Text>
						<Dialog.Text className="text-sm">
							Devices authenticated with this key will be automatically removed
							once they go offline.{' '}
							<Link
								name="Tailscale Ephemeral Nodes Documentation"
								to="https://tailscale.com/kb/1111/ephemeral-nodes"
							>
								Learn more
							</Link>
						</Dialog.Text>
					</div>
					<Switch
						defaultSelected={ephemeral}
						label="Ephemeral"
						name="ephemeral"
						onChange={() => {
							setEphemeral(!ephemeral);
						}}
					/>
				</div>
				<input name="ephemeral" type="hidden" value={ephemeral.toString()} />
			</Dialog.Panel>
		</Dialog>
	);
}
