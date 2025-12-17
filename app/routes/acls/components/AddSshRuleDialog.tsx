import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';

export type NewSshRuleInput = {
	source: string;
	destination: string;
	users: string;
	checkMode: string;
	note: string;
};

interface AddSshRuleDialogProps {
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	onAddRule: (input: NewSshRuleInput) => void;
}

export default function AddSshRuleDialog({
	isOpen,
	setIsOpen,
	onAddRule,
}: AddSshRuleDialogProps) {
	const [source, setSource] = useState('');
	const [destination, setDestination] = useState('');
	const [users, setUsers] = useState('');
	const [checkMode, setCheckMode] = useState('check');
	const [note, setNote] = useState('');

	// Reset local state whenever the dialog is opened/closed
	useEffect(() => {
		if (!isOpen) {
			setSource('');
			setDestination('');
			setUsers('');
			setCheckMode('check');
			setNote('');
		}
	}, [isOpen]);

	const isConfirmDisabled =
		!source.trim() || !destination.trim() || !users.trim();

	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Panel
				isDisabled={isConfirmDisabled}
				onSubmit={(event: FormEvent<HTMLFormElement>) => {
					event.preventDefault();

					onAddRule({
						source: source.trim(),
						destination: destination.trim(),
						users: users.trim(),
						checkMode: checkMode.trim(),
						note: note.trim(),
					});
				}}
				variant="normal"
			>
				<div className="p-6">
					<Dialog.Title className="mb-2">Add SSH rule</Dialog.Title>
					<p className="text-sm text-headplane-600 dark:text-headplane-300 mb-6">
						Define a new Tailscale SSH rule. The rule will be shown in the
						visual editor and rendered as a HuJSON snippet you can copy into
						your SSH policy.
					</p>

					<div className="space-y-4">
						<Input
							description="Users, groups, tags, or devices that are allowed to SSH. Separate multiple entries with commas."
							label="Sources"
							onChange={(value) => setSource(value)}
							value={source}
						/>

						<Input
							description="Devices these sources can SSH into. Separate multiple entries with commas."
							label="Destinations"
							onChange={(value) => setDestination(value)}
							value={destination}
						/>

						<Input
							description='UNIX users to SSH as, for example "autogroup:nonroot, root". Separate multiple entries with commas.'
							label="Users"
							onChange={(value) => setUsers(value)}
							value={users}
						/>

						<Input
							description='SSH rule action, for example "check" or "enforce". Leave blank to omit the action field.'
							label="Check mode (optional)"
							onChange={(value) => setCheckMode(value)}
							value={checkMode}
						/>

						<div className="flex flex-col w-full">
							<label
								className="text-xs font-medium px-3 mb-0.5 text-headplane-700 dark:text-headplane-100"
								htmlFor="add-ssh-rule-note"
							>
								Note
							</label>
							<textarea
								className="rounded-xl px-3 py-2 min-h-[96px] resize-y focus:outline-hidden focus:ring-3 bg-white dark:bg-headplane-900 border border-headplane-100 dark:border-headplane-800"
								id="add-ssh-rule-note"
								onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
									setNote(event.target.value)
								}
								placeholder="Optional comments about this SSH rule."
								value={note}
							/>
							<p className="text-xs px-3 mt-1 text-headplane-500 dark:text-headplane-400">
								Notes are rendered as comments above each SSH rule in the HuJSON
								snippet.
							</p>
						</div>
					</div>
				</div>
			</Dialog.Panel>
		</Dialog>
	);
}
