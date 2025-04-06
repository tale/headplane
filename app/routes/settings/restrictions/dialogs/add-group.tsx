import { useMemo, useState } from 'react';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';

interface AddGroupProps {
	groups: string[];
	isDisabled?: boolean;
}

export default function AddGroup({ groups, isDisabled }: AddGroupProps) {
	const [group, setGroup] = useState('');

	const isInvalid = useMemo(() => {
		if (!group || group.trim().length === 0) {
			// Empty group is invalid, but no error shown
			return false;
		}

		if (groups.includes(group.trim())) {
			return true;
		}
	}, [group, groups]);

	return (
		<Dialog>
			<Dialog.Button isDisabled={isDisabled}>Add group</Dialog.Button>
			<Dialog.Panel>
				<Dialog.Title>Add group</Dialog.Title>
				<Dialog.Text className="mb-4">
					Add this group to a list of allowed groups that can authenticate with
					Headscale via OIDC.
				</Dialog.Text>
				<input type="hidden" name="action_id" value="add_group" />
				<Input
					isRequired
					label="Group"
					description="The group to allow for OIDC authentication."
					placeholder="admin"
					name="group"
					onChange={setGroup}
					isInvalid={group.trim().length === 0 || isInvalid}
				/>
				{isInvalid && (
					<p className="text-red-500 text-sm mt-2">
						The group you entered already exists in the list of allowed groups.
					</p>
				)}
			</Dialog.Panel>
		</Dialog>
	);
}
