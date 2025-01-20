import { Form, useSubmit } from 'react-router';
import { type Dispatch, type SetStateAction, useState } from 'react';

import Code from '~/components/Code';
import Dialog from '~/components/Dialog';
import TextField from '~/components/TextField';
import type { Machine } from '~/types';

interface RenameProps {
	readonly machine: Machine;
	readonly state: [boolean, Dispatch<SetStateAction<boolean>>];
	readonly magic?: string;
}

export default function Rename({ machine, state, magic }: RenameProps) {
	const [name, setName] = useState(machine.givenName);
	const submit = useSubmit();

	return (
		<Dialog>
			<Dialog.Panel control={state}>
				{(close) => (
					<>
						<Dialog.Title>
							Edit machine name for {machine.givenName}
						</Dialog.Title>
						<Dialog.Text>
							This name is shown in the admin panel, in Tailscale clients, and
							used when generating MagicDNS names.
						</Dialog.Text>
						<Form
							method="POST"
							onSubmit={(e) => {
								submit(e.currentTarget);
							}}
						>
							<input type="hidden" name="_method" value="rename" />
							<input type="hidden" name="id" value={machine.id} />
							<TextField
								label="Machine name"
								placeholder="Machine name"
								name="name"
								state={[name, setName]}
								className="my-2"
							/>
							{magic ? (
								name.length > 0 && name !== machine.givenName ? (
									<p className="text-sm text-gray-500 dark:text-gray-300 leading-tight">
										This machine will be accessible by the hostname{' '}
										<Code className="text-sm">
											{name.toLowerCase().replaceAll(/\s+/g, '-')}
										</Code>
										{'. '}
										The hostname{' '}
										<Code className="text-sm">{machine.givenName}</Code> will no
										longer point to this machine.
									</p>
								) : (
									<p className="text-sm text-gray-500 dark:text-gray-300 leading-tight">
										This machine is accessible by the hostname{' '}
										<Code className="text-sm">{machine.givenName}</Code>.
									</p>
								)
							) : undefined}
							<Dialog.Gutter>
								<Dialog.Action variant="cancel" onPress={close}>
									Cancel
								</Dialog.Action>
								<Dialog.Action variant="confirm" onPress={close}>
									Rename
								</Dialog.Action>
							</Dialog.Gutter>
						</Form>
					</>
				)}
			</Dialog.Panel>
		</Dialog>
	);
}
