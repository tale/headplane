import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';
import type { TagOwnerEntry } from './TagsPanel';

interface EditTagOwnerDialogProps {
	entry: TagOwnerEntry | null;
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	onSave?: (input: { tagName: string; owners: string; note: string }) => void;
}

export default function EditTagOwnerDialog({
	entry,
	isOpen,
	setIsOpen,
	onSave,
}: EditTagOwnerDialogProps) {
	const [tagName, setTagName] = useState(entry?.tagName ?? '');
	const [owners, setOwners] = useState(entry?.owners ?? '');
	const [note, setNote] = useState(entry?.note ?? '');

	// Keep local state in sync when a new entry is selected or dialog re-opens
	useEffect(() => {
		setTagName(entry?.tagName ?? '');
		setOwners(entry?.owners ?? '');
		setNote(entry?.note ?? '');
	}, [entry, isOpen]);

	const isConfirmDisabled = !tagName.trim() || !owners.trim();

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

					if (!tagName.trim() || !owners.trim()) {
						return;
					}

					onSave({
						tagName: tagName.trim(),
						owners: owners.trim(),
						note: note.trim(),
					});
				}}
				variant="normal"
			>
				<div className="p-6">
					<Dialog.Title className="mb-2">Edit tag owner</Dialog.Title>
					<p className="text-sm text-headplane-600 dark:text-headplane-300 mb-6">
						Update which users or groups are allowed to own this tag. Changes
						will be saved to the ACL policy JSON in the "tagOwners" section,
						preserving comments and formatting.
					</p>

					<div className="space-y-4">
						<Input
							description="The Tailscale tag, for example tag:prod-databases or tag:dev-app-servers."
							label="Tag name"
							onChange={(value) => setTagName(value)}
							value={tagName}
						/>

						<Input
							description="Comma-separated list of users or groups allowed to own this tag, for example group:admin, group:dev."
							label="Tag owners"
							onChange={(value) => setOwners(value)}
							value={owners}
						/>

						<div className="flex flex-col w-full">
							<label
								className="text-xs font-medium px-3 mb-0.5 text-headplane-700 dark:text-headplane-100"
								htmlFor="edit-tag-owner-note"
							>
								Note
							</label>
							<textarea
								className="rounded-xl px-3 py-2 min-h-[96px] resize-y focus:outline-hidden focus:ring-3 bg-white dark:bg-headplane-900 border border-headplane-100 dark:border-headplane-800"
								id="edit-tag-owner-note"
								onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
									setNote(event.target.value)
								}
								placeholder="Optional comments about this tag owner mapping. Stored as comments above the entry in the JSON policy."
								value={note}
							/>
							<p className="text-xs px-3 mt-1 text-headplane-500 dark:text-headplane-400">
								Notes are stored as comments above each tag owner entry in the
								JSON policy.
							</p>
						</div>
					</div>
				</div>
			</Dialog.Panel>
		</Dialog>
	);
}
