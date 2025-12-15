import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';
import type { GroupEntry } from './GroupsPanel';

interface EditGroupDialogProps {
	entry: GroupEntry | null;
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	onSave?: (input: {
		groupName: string;
		members: string;
		note: string;
	}) => void;
}

export default function EditGroupDialog({
	entry,
	isOpen,
	setIsOpen,
	onSave,
}: EditGroupDialogProps) {
	const [groupName, setGroupName] = useState(entry?.groupName ?? '');
	const [members, setMembers] = useState(entry?.members ?? '');
	const [note, setNote] = useState(entry?.note ?? '');

	// Keep local state in sync when a new entry is selected or dialog re-opens
	useEffect(() => {
		setGroupName(entry?.groupName ?? '');
		setMembers(entry?.members ?? '');
		setNote(entry?.note ?? '');
	}, [entry, isOpen]);

	const groupNameError = useMemo(() => {
		const value = groupName.trim();

		if (!value) {
			return 'Group is required.';
		}

		if (!value.startsWith('group:')) {
			return 'Groups must start with "group:".';
		}

		const body = value.slice('group:'.length);

		if (!body) {
			return 'Group name after "group:" is required.';
		}

		if (!/^[a-z0-9-]+$/.test(body)) {
			return 'Use only lowercase letters, numbers, and hyphens in the group name.';
		}

		return '';
	}, [groupName]);

	const membersError = useMemo(() => {
		const raw = members.trim();
		if (!raw) {
			return 'At least one member is required.';
		}

		const parts = raw
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean);

		if (parts.length === 0) {
			return 'At least one member is required.';
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
			return `Invalid member "${invalid}". Members must be users (containing "@"), groups (starting with "group:"), or tags (starting with "tag:").`;
		}

		return '';
	}, [members]);

	const isConfirmDisabled = !!groupNameError || !!membersError;

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

					if (groupNameError || membersError) {
						return;
					}

					onSave({
						groupName: groupName.trim(),
						members: members.trim(),
						note: note.trim(),
					});
				}}
				variant="normal"
			>
				<div className="p-6">
					<Dialog.Title className="mb-2">Edit group</Dialog.Title>
					<p className="text-sm text-headplane-600 dark:text-headplane-300 mb-6">
						Update this user-defined group. Changes will be saved to the ACL
						policy JSON in the "groups" section, preserving comments and
						formatting.
					</p>

					<div className="space-y-4">
						<Input
							description='The Tailscale group name, for example group:dev or group:admin-team. Group names must start with "group:" and use only lowercase letters, numbers, and hyphens.'
							errorMessage={groupNameError}
							isInvalid={!!groupNameError}
							isRequired
							label="Group name"
							onChange={(value) => setGroupName(value)}
							value={groupName}
						/>

						<Input
							description="Comma-separated list of users, groups, or tags that are members of this group, for example alice@example.com, group:admin, tag:prod-db-1."
							errorMessage={membersError}
							isInvalid={!!membersError}
							isRequired
							label="Group members"
							onChange={(value) => setMembers(value)}
							value={members}
						/>

						<div className="flex flex-col w-full">
							<label
								className="text-xs font-medium px-3 mb-0.5 text-headplane-700 dark:text-headplane-100"
								htmlFor="edit-group-note"
							>
								Note
							</label>
							<textarea
								className="rounded-xl px-3 py-2 min-h-[96px] resize-y focus:outline-hidden focus:ring-3 bg-white dark:bg-headplane-900 border border-headplane-100 dark:border-headplane-800"
								id="edit-group-note"
								onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
									setNote(event.target.value)
								}
								placeholder="Optional comments about this group. Stored as comments above the entry in the JSON policy."
								value={note}
							/>
							<p className="text-xs px-3 mt-1 text-headplane-500 dark:text-headplane-400">
								Notes are stored as comments above each group entry in the JSON
								policy.
							</p>
						</div>
					</div>
				</div>
			</Dialog.Panel>
		</Dialog>
	);
}
