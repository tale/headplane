import { XIcon } from '@primer/octicons-react';
import { Form, useSubmit } from 'react-router';
import { useState } from 'react';

import Button from '~/components/Button';
import Code from '~/components/Code';
import Dialog from '~/components/Dialog';

interface Props {
	username: string;
}

export default function Remove({ username }: Props) {
	const submit = useSubmit();
	const dialogState = useState(false);

	return (
		<>
			<Button
				variant="light"
				control={dialogState}
				className="rounded-full p-0 w-8 h-8 flex items-center justify-center"
			>
				<XIcon className="w-4 h-4" />
			</Button>
			<Dialog control={dialogState}>
				<Dialog.Panel control={dialogState}>
					{(close) => (
						<>
							<Dialog.Title>Delete {username}?</Dialog.Title>
							<Dialog.Text className="mb-8">
								Are you sure you want to delete {username}? A deleted user
								cannot be recovered.
							</Dialog.Text>
							<Form
								method="POST"
								onSubmit={(event) => {
									submit(event.currentTarget);
								}}
							>
								<input type="hidden" name="_method" value="delete" />
								<input type="hidden" name="username" value={username} />
								<div className="mt-6 flex justify-end gap-2 mt-6">
									<Dialog.Action variant="cancel" onPress={close}>
										Cancel
									</Dialog.Action>
									<Dialog.Action variant="confirm" onPress={close}>
										Delete
									</Dialog.Action>
								</div>
							</Form>
						</>
					)}
				</Dialog.Panel>
			</Dialog>
		</>
	);
}
