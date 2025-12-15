import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';

export type NewGeneralAccessRuleInput = {
	source: string;
	destination: string;
	// Raw protocol value written to the ACL JSON (proto field), e.g. "tcp".
	// Leave empty to allow any protocol.
	protocol: string;
	note: string;
};

interface AddGeneralAccessRuleDialogProps {
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	onAddRule: (input: NewGeneralAccessRuleInput) => void;
}

export default function AddGeneralAccessRuleDialog({
	isOpen,
	setIsOpen,
	onAddRule,
}: AddGeneralAccessRuleDialogProps) {
	const [source, setSource] = useState('');
	const [destination, setDestination] = useState('');
	const [protocol, setProtocol] = useState('');
	const [note, setNote] = useState('');

	// Reset local state whenever the dialog is opened/closed
	useEffect(() => {
		if (!isOpen) {
			setSource('');
			setDestination('');
			setProtocol('');
			setNote('');
		}
	}, [isOpen]);

	const isConfirmDisabled = !source.trim() || !destination.trim();

	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Panel
				isDisabled={isConfirmDisabled}
				onSubmit={(event: FormEvent<HTMLFormElement>) => {
					event.preventDefault();

					onAddRule({
						source: source.trim(),
						destination: destination.trim(),
						protocol: protocol.trim(),
						note: note.trim(),
					});
				}}
				variant="normal"
			>
				<div className="p-6">
					<Dialog.Title className="mb-2">Add rule</Dialog.Title>
					<p className="text-sm text-headplane-600 dark:text-headplane-300 mb-6">
						Define a new general access rule. The rule will be added to the ACL
						policy JSON, preserving comments and formatting.
					</p>

					<div className="space-y-4">
						<Input
							description="Users, groups, tags, or devices that can initiate connections. Separate multiple entries with commas."
							label="Sources"
							onChange={(value) => setSource(value)}
							value={source}
						/>

						<Input
							description="Hosts, tags, or IP ranges these sources can connect to. Separate multiple entries with commas."
							label="Destinations"
							onChange={(value) => setDestination(value)}
							value={destination}
						/>

						<Input
							description='Protocol for this rule, for example "tcp" or "icmp". Leave blank to allow any protocol.'
							label="Protocol (optional)"
							onChange={(value) => setProtocol(value)}
							value={protocol}
						/>

						<div className="flex flex-col w-full">
							<label
								className="text-xs font-medium px-3 mb-0.5 text-headplane-700 dark:text-headplane-100"
								htmlFor="add-general-access-rule-note"
							>
								Note
							</label>
							<textarea
								className="rounded-xl px-3 py-2 min-h-[96px] resize-y focus:outline-hidden focus:ring-3 bg-white dark:bg-headplane-900 border border-headplane-100 dark:border-headplane-800"
								id="add-general-access-rule-note"
								onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
									setNote(event.target.value)
								}
								placeholder="Optional comments about this rule. Stored as comments above the ACL rule in the JSON policy."
								value={note}
							/>
							<p className="text-xs px-3 mt-1 text-headplane-500 dark:text-headplane-400">
								Notes are stored as comments above each ACL rule in the JSON
								policy.
							</p>
						</div>
					</div>
				</div>
			</Dialog.Panel>
		</Dialog>
	);
}
