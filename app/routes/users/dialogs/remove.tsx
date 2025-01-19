import { X } from 'lucide-react';
import { Form, useSubmit } from 'react-router';
import { useState } from 'react';

import IconButton from '~/components/IconButton';
import Code from '~/components/Code';
import Dialog from '~/components/Dialog';

interface Props {
	username: string;
}

export default function Remove({ username }: Props) {
	const submit = useSubmit();
	const [dialog, setDialog] = useState(false);

	return (
		<>
			<IconButton
				label={`Delete ${username}`}
				onPress={() => setDialog(true)}
			>
				<X className="p-0.5" />
			</IconButton>
			<Dialog control={[dialog, setDialog]}>
				<Dialog.Panel control={[dialog, setDialog]}>
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
