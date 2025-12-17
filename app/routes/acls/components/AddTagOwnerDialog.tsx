import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';

export type NewTagOwnerInput = {
	tagName: string;
	owners: string;
	note: string;
};

interface AddTagOwnerDialogProps {
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	onAddTagOwner: (input: NewTagOwnerInput) => void;
}

export default function AddTagOwnerDialog({
	isOpen,
	setIsOpen,
	onAddTagOwner,
}: AddTagOwnerDialogProps) {
	const [tagName, setTagName] = useState('tag:');
	const [owners, setOwners] = useState('');
	const [note, setNote] = useState('');

	// Reset local state whenever the dialog is opened/closed
	useEffect(() => {
		if (!isOpen) {
			setTagName('tag:');
			setOwners('');
			setNote('');
		}
	}, [isOpen]);

	const tagNameError = useMemo(() => {
		const value = tagName.trim();

		if (!value) {
			return 'Tag is required.';
		}

		if (!value.startsWith('tag:')) {
			return 'Tags must start with "tag:".';
		}

		const body = value.slice(4);

		if (!body) {
			return 'Tag name after "tag:" is required.';
		}

		if (!/^[a-z0-9-]+$/.test(body)) {
			return 'Use only lowercase letters, numbers, and hyphens in the tag name.';
		}

		return '';
	}, [tagName]);

	const ownersError = useMemo(() => {
		const raw = owners.trim();
		if (!raw) {
			return 'At least one owner is required.';
		}

		const parts = raw
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean);

		if (parts.length === 0) {
			return 'At least one owner is required.';
		}

		const invalid = parts.find(
			(alias) =>
				!(
					alias.includes('@') ||
					alias.startsWith('group:') ||
					alias.startsWith('tag:')
				),
		);

		if (invalid) {
			return `Invalid owner "${invalid}". Owners must be users (containing "@"), groups (starting with "group:"), or tags (starting with "tag:").`;
		}

		return '';
	}, [owners]);

	const isConfirmDisabled = !!tagNameError || !!ownersError;

	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Panel
				isDisabled={isConfirmDisabled}
				onSubmit={(event: FormEvent<HTMLFormElement>) => {
					event.preventDefault();

					if (tagNameError || ownersError) {
						return;
					}

					onAddTagOwner({
						tagName: tagName.trim(),
						owners: owners.trim(),
						note: note.trim(),
					});
				}}
				variant="normal"
			>
				<div className="p-6">
					<Dialog.Title className="mb-2">Create tag owner</Dialog.Title>
					<p className="text-sm text-headplane-600 dark:text-headplane-300 mb-6">
						Define which users or groups are allowed to own a given tag. The
						entry will be added to the ACL policy JSON in the "tagOwners"
						section, preserving comments and formatting.
					</p>

					<div className="space-y-4">
						<Input
							description='The Tailscale tag, for example tag:prod-databases or tag:dev-app-servers. Tag names must start with "tag:" and use only lowercase letters, numbers, and hyphens.'
							errorMessage={tagNameError}
							isInvalid={!!tagNameError}
							isRequired
							label="Tag name"
							onChange={(value) => setTagName(value)}
							value={tagName}
						/>

						<Input
							description="Comma-separated list of users, groups, or tags allowed to own this tag, for example alice@example.com, group:admin, tag:prod-db-1."
							errorMessage={ownersError}
							isInvalid={!!ownersError}
							isRequired
							label="Tag owners"
							onChange={(value) => setOwners(value)}
							value={owners}
						/>

						<div className="flex flex-col w-full">
							<label
								className="text-xs font-medium px-3 mb-0.5 text-headplane-700 dark:text-headplane-100"
								htmlFor="add-tag-owner-note"
							>
								Note
							</label>
							<textarea
								className="rounded-xl px-3 py-2 min-h-[96px] resize-y focus:outline-hidden focus:ring-3 bg-white dark:bg-headplane-900 border border-headplane-100 dark:border-headplane-800"
								id="add-tag-owner-note"
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
