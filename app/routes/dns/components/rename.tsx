import { useFetcher } from 'react-router';
import { useState } from 'react';
import { Input } from 'react-aria-components';

import Code from '~/components/Code';
import Dialog from '~/components/Dialog';
import Spinner from '~/components/Spinner';
import TextField from '~/components/TextField';
import { cn } from '~/utils/cn';

type Properties = {
	readonly name: string;
	readonly disabled?: boolean;
};

export default function Modal({ name, disabled }: Properties) {
	const [newName, setNewName] = useState(name);
	const fetcher = useFetcher();

	return (
		<div className="flex flex-col w-2/3">
			<h1 className="text-2xl font-medium mb-4">Tailnet Name</h1>
			<p className="text-gray-700 dark:text-gray-300">
				This is the base domain name of your Tailnet. Devices are accessible at{' '}
				<Code>[device].{name}</Code> when Magic DNS is enabled.
			</p>
			<Input
				readOnly
				className={cn(
					'block px-2.5 py-1.5 w-1/2 rounded-lg my-4',
					'border border-ui-200 dark:border-ui-600',
					'dark:bg-ui-800 dark:text-ui-300 text-sm',
					'outline-none',
				)}
				type="text"
				value={name}
				onFocus={(event) => {
					event.target.select();
				}}
			/>
			<Dialog>
				<Dialog.Button isDisabled={disabled}>
					{fetcher.state === 'idle' ? undefined : (
						<Spinner className="w-3 h-3" />
					)}
					Rename Tailnet
				</Dialog.Button>
				<Dialog.Panel>
					{(close) => (
						<>
							<Dialog.Title>Rename Tailnet</Dialog.Title>
							<Dialog.Text>
								Keep in mind that changing this can lead to all sorts of
								unexpected behavior and may break existing devices in your
								tailnet.
							</Dialog.Text>
							<TextField
								label="Tailnet name"
								placeholder="ts.net"
								state={[newName, setNewName]}
								className="my-2"
							/>
							<Dialog.Gutter>
								<Dialog.Action variant="cancel" onPress={close}>
									Cancel
								</Dialog.Action>
								<Dialog.Action
									variant="confirm"
									onPress={() => {
										fetcher.submit(
											{
												'dns.base_domain': newName,
											},
											{
												method: 'PATCH',
												encType: 'application/json',
											},
										);

										close();
									}}
								>
									Rename
								</Dialog.Action>
							</Dialog.Gutter>
						</>
					)}
				</Dialog.Panel>
			</Dialog>
		</div>
	);
}
