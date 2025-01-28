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
				<Dialog.Text>
					This name is shown in the admin panel, in Tailscale clients, and used
					when generating MagicDNS names.
				</Dialog.Text>
				<input type="hidden" name="_method" value="rename" />
				<input type="hidden" name="id" value={machine.id} />
				<Input
					label="Machine name"
					placeholder="Machine name"
					name="name"
					defaultValue={machine.givenName}
					onChange={setName}
				/>
				{magic ? (
					name.length > 0 && name !== machine.givenName ? (
						<p className="text-sm text-gray-500 dark:text-gray-300 leading-tight">
							This machine will be accessible by the hostname{' '}
							<Code className="text-sm">
								{name.toLowerCase().replaceAll(/\s+/g, '-')}
							</Code>
							{'. '}
							The hostname <Code className="text-sm">{machine.givenName}</Code>{' '}
							will no longer point to this machine.
						</p>
					) : (
						<p className="text-sm text-gray-500 dark:text-gray-300 leading-tight">
							This machine is accessible by the hostname{' '}
							<Code className="text-sm">{machine.givenName}</Code>.
						</p>
					)
				) : undefined}
			</Dialog.Panel>
		</Dialog>
	);
}
