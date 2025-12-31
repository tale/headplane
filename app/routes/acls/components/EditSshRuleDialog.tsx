import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';

interface EditSshRuleDialogProps {
	rule: {
		id: string;
		source: string;
		destination: string;
		users: string;
		checkMode?: string;
		note?: string;
	} | null;
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	onSave?: (input: {
		source: string;
		destination: string;
		users: string;
		checkMode: string;
		note: string;
	}) => void;
}

export default function EditSshRuleDialog({
	rule,
	isOpen,
	setIsOpen,
	onSave,
}: EditSshRuleDialogProps) {
	const [source, setSource] = useState(rule?.source ?? '');
	const [destination, setDestination] = useState(rule?.destination ?? '');
	const [users, setUsers] = useState(rule?.users ?? '');
	const [checkMode, setCheckMode] = useState(rule?.checkMode ?? 'check');
	const [note, setNote] = useState(rule?.note ?? '');

	// Keep local state in sync when a new rule is selected or dialog re-opens
	useEffect(() => {
		setSource(rule?.source ?? '');
		setDestination(rule?.destination ?? '');
		setUsers(rule?.users ?? '');
		setCheckMode(rule?.checkMode ?? 'check');
		setNote(rule?.note ?? '');
	}, [rule, isOpen]);

	const isConfirmDisabled =
		!source.trim() || !destination.trim() || !users.trim();

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
						users: users.trim(),
						checkMode: checkMode.trim(),
						note: note.trim(),
					});
				}}
				variant="normal"
			>
				<div className="p-6">
					<Dialog.Title className="mb-2">Edit SSH rule</Dialog.Title>
					<p className="text-sm text-headplane-600 dark:text-headplane-300 mb-6">
						Update this Tailscale SSH rule. Changes will be reflected in the
						visual editor and in the HuJSON snippet.
					</p>

					<div className="space-y-4">
						<Input
							description="Users, groups, tags, or devices that are allowed to SSH."
							label="Sources"
							onChange={(value) => setSource(value)}
							value={source}
						/>

						<Input
							description="Devices these sources can SSH into."
							label="Destinations"
							onChange={(value) => setDestination(value)}
							value={destination}
						/>

						<Input
							description='UNIX users to SSH as, for example "autogroup:nonroot, root".'
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
								htmlFor="edit-ssh-rule-note"
							>
								Note
							</label>
							<textarea
								className="rounded-xl px-3 py-2 min-h-[96px] resize-y focus:outline-hidden focus:ring-3 bg-white dark:bg-headplane-900 border border-headplane-100 dark:border-headplane-800"
								id="edit-ssh-rule-note"
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
