import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';
import type { GeneralAccessRule } from './GeneralAccessRulesPanel';

interface EditGeneralAccessRuleDialogProps {
	rule: GeneralAccessRule | null;
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	onSave?: (input: {
		source: string;
		destination: string;
		protocol: string;
		note: string;
	}) => void;
}

export default function EditGeneralAccessRuleDialog({
	rule,
	isOpen,
	setIsOpen,
	onSave,
}: EditGeneralAccessRuleDialogProps) {
	const [source, setSource] = useState(rule?.source ?? '');
	const [destination, setDestination] = useState(rule?.destination ?? '');
	const [protocol, setProtocol] = useState(rule?.protocol ?? '');
	const [note, setNote] = useState(rule?.note ?? '');

	// Keep local state in sync when a new rule is selected or dialog re-opens
	useEffect(() => {
		setSource(rule?.source ?? '');
		setDestination(rule?.destination ?? '');
		setProtocol(rule?.protocol ?? '');
		setNote(rule?.note ?? '');
	}, [rule, isOpen]);

	const isConfirmDisabled = !source.trim() || !destination.trim();

	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Panel
				confirmLabel="Save"
				isDisabled={isConfirmDisabled}
				onSubmit={(event: FormEvent<HTMLFormElement>) => {
					event.preventDefault();

					if (!onSave) {
						return;
					}

					onSave({
						source: source.trim(),
						destination: destination.trim(),
						protocol: protocol.trim(),
						note: note.trim(),
					});
				}}
				variant="normal"
			>
				<div className="p-6">
					<Dialog.Title className="mb-2">Edit rule</Dialog.Title>
					<p className="text-sm text-headplane-600 dark:text-headplane-300 mb-6">
						Update this access rule. Changes will be saved to the ACL policy
						JSON, preserving comments and formatting.
					</p>

					<div className="space-y-4">
						<Input
							description="Users, groups, tags, or devices that can initiate connections."
							label="Sources"
							onChange={(value) => setSource(value)}
							value={source}
						/>

						<Input
							description="Hosts, tags, or IP ranges these sources can connect to."
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
								htmlFor="edit-general-access-rule-note"
							>
								Note
							</label>
							<textarea
								className="rounded-xl px-3 py-2 min-h-[96px] resize-y focus:outline-hidden focus:ring-3 bg-white dark:bg-headplane-900 border border-headplane-100 dark:border-headplane-800"
								id="edit-general-access-rule-note"
								onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
									setNote(event.target.value)
								}
								placeholder="Optional comments about this rule."
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
