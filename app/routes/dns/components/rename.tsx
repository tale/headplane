import { useState } from 'react';
import { useFetcher } from 'react-router';

import Code from '~/components/Code';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';
import Spinner from '~/components/Spinner';
import { cn } from '~/utils/cn';

type Properties = {
	readonly name: string;
	readonly disabled?: boolean;
};

// TODO: Switch to form submit instead of JSON patch
export default function Modal({ name, disabled }: Properties) {
	const [newName, setNewName] = useState(name);
	const fetcher = useFetcher();

	return (
		<div className="flex flex-col w-2/3 gap-y-4">
			<h1 className="text-2xl font-medium mb-2">Tailnet Name</h1>
			<p>
				This is the base domain name of your Tailnet. Devices are accessible at{' '}
				<Code>[device].{name}</Code> when Magic DNS is enabled.
			</p>
			<Input
				isReadOnly
				className="w-3/5 font-medium text-sm"
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
				<Dialog.Panel
					onSubmit={() => {
						fetcher.submit(
							{
								'dns.base_domain': newName,
							},
							{
								method: 'PATCH',
								encType: 'application/json',
							},
						);
					}}
				>
					<Dialog.Title>Rename Tailnet</Dialog.Title>
					<Dialog.Text>
						Keep in mind that changing this can lead to all sorts of unexpected
						behavior and may break existing devices in your tailnet.
					</Dialog.Text>
					<Input
						label="Tailnet name"
						placeholder="ts.net"
						onChange={setNewName}
					/>
				</Dialog.Panel>
			</Dialog>
		</div>
	);
}
