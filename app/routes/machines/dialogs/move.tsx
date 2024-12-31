import { Form, useSubmit } from 'react-router';
import { type Dispatch, type SetStateAction, useState } from 'react';

import Code from '~/components/Code';
import Dialog from '~/components/Dialog';
import Select from '~/components/Select';
import type { Machine, User } from '~/types';

interface MoveProps {
	readonly machine: Machine;
	readonly users: User[];
	readonly state: [boolean, Dispatch<SetStateAction<boolean>>];
	readonly magic?: string;
}

export default function Move({ machine, state, magic, users }: MoveProps) {
	const [owner, setOwner] = useState(machine.user.name);
	const submit = useSubmit();

	return (
		<Dialog>
			<Dialog.Panel control={state}>
				{(close) => (
					<>
						<Dialog.Title>Change the owner of {machine.givenName}</Dialog.Title>
						<Dialog.Text>
							The owner of the machine is the user associated with it.
						</Dialog.Text>
						<Form
							method="POST"
							onSubmit={(e) => {
								submit(e.currentTarget);
							}}
						>
							<input type="hidden" name="_method" value="move" />
							<input type="hidden" name="id" value={machine.id} />
							<Select
								label="Owner"
								name="to"
								placeholder="Select a user"
								state={[owner, setOwner]}
							>
								{users.map((user) => (
									<Select.Item key={user.id} id={user.name}>
										{user.name}
									</Select.Item>
								))}
							</Select>
							{magic ? (
								<p className="text-sm text-gray-500 dark:text-gray-300 leading-tight">
									This machine is accessible by the hostname{' '}
									<Code className="text-sm">
										{machine.givenName}.{magic}
									</Code>
									.
								</p>
							) : undefined}
							<div className="mt-6 flex justify-end gap-2 mt-6">
								<Dialog.Action variant="cancel" onPress={close}>
									Cancel
								</Dialog.Action>
								<Dialog.Action variant="confirm" onPress={close}>
									Change owner
								</Dialog.Action>
							</div>
						</Form>
					</>
				)}
			</Dialog.Panel>
		</Dialog>
	);
}
