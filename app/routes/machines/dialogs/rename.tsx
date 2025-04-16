import { useState } from 'react';
import Code from '~/components/Code';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';
import type { Machine } from '~/types';

interface RenameProps {
	machine: Machine;
	isOpen: boolean;
	magic?: string;
	setIsOpen: (isOpen: boolean) => void;
}

export default function Rename({
	machine,
	magic,
	isOpen,
	setIsOpen,
}: RenameProps) {
	const [name, setName] = useState(machine.givenName);

	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Panel>
				<Dialog.Title>Edit machine name for {machine.givenName}</Dialog.Title>
				<Dialog.Text className="mb-6">
					This name is shown in the admin panel, in Tailscale clients, and used
					when generating MagicDNS names.
				</Dialog.Text>
				<input type="hidden" name="action_id" value="rename" />
				<input type="hidden" name="node_id" value={machine.id} />
				<Input
					label="Machine name"
					placeholder="Machine name"
					name="name"
					defaultValue={machine.givenName}
					onChange={setName}
				/>
				{magic ? (
					name.length > 0 && name !== machine.givenName ? (
						<p className="text-sm text-headplane-600 dark:text-headplane-300 leading-tight mt-2">
							This machine will be accessible by the hostname{' '}
							<Code className="text-sm">
								{name.toLowerCase().replaceAll(/\s+/g, '-')}
							</Code>
							{'. '}
							The hostname <Code className="text-sm">{machine.givenName}</Code>{' '}
							will no longer point to this machine.
						</p>
					) : (
						<p className="text-sm text-headplane-600 dark:text-headplane-300 leading-tight mt-2">
							This machine is accessible by the hostname{' '}
							<Code className="text-sm">{machine.givenName}</Code>.
						</p>
					)
				) : undefined}
			</Dialog.Panel>
		</Dialog>
	);
}
