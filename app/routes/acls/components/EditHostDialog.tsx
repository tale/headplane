import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';
import type { HostEntry } from './HostsPanel';

function isValidIpOrCidr(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;

	// Basic IPv4 (e.g. 192.168.0.1)
	const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

	// IPv4 CIDR (e.g. 192.168.0.0/24)
	const ipv4Cidr =
		/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}\/([0-9]|[1-2]\d|3[0-2])$/;

	return ipv4.test(trimmed) || ipv4Cidr.test(trimmed);
}

interface EditHostDialogProps {
	host: HostEntry | null;
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	onSave?: (input: { name: string; address: string; note: string }) => void;
}

export default function EditHostDialog({
	host,
	isOpen,
	setIsOpen,
	onSave,
}: EditHostDialogProps) {
	const [name, setName] = useState(host?.name ?? '');
	const [address, setAddress] = useState(host?.address ?? '');
	const [note, setNote] = useState(host?.note ?? '');
	const [addressError, setAddressError] = useState<string | null>(null);

	// Keep local state in sync when a new host is selected or dialog re-opens
	useEffect(() => {
		setName(host?.name ?? '');
		setAddress(host?.address ?? '');
		setNote(host?.note ?? '');
		setAddressError(null);
	}, [host, isOpen]);

	const isConfirmDisabled =
		!name.trim() ||
		!address.trim() ||
		!!addressError ||
		!isValidIpOrCidr(address);

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

					if (!name.trim() || !isValidIpOrCidr(address)) {
						return;
					}

					onSave({
						name: name.trim(),
						address: address.trim(),
						note: note.trim(),
					});
				}}
				variant="normal"
			>
				<div className="p-6">
					<Dialog.Title className="mb-2">Edit host</Dialog.Title>
					<p className="text-sm text-headplane-600 dark:text-headplane-300 mb-6">
						Update this host mapping. Changes will be saved to the ACL policy
						JSON in the "hosts" section, preserving comments and formatting.
					</p>

					<div className="space-y-4">
						<Input
							description="The friendly host name, for example db or web-admin.example.com."
							label="Host name"
							onChange={(value) => setName(value)}
							value={name}
						/>

						<Input
							description="The IP address or CIDR this host name should resolve to."
							label="IP address or CIDR"
							onChange={(value) => {
								setAddress(value);

								if (!value.trim()) {
									setAddressError('IP address or CIDR is required.');
								} else if (!isValidIpOrCidr(value)) {
									setAddressError(
										'Enter a valid IPv4 address or CIDR (for example 192.168.0.1 or 192.168.0.0/24).',
									);
								} else {
									setAddressError(null);
								}
							}}
							value={address}
						/>
						{addressError && (
							<p className="text-xs px-3 mt-1 text-red-600 dark:text-red-400">
								{addressError}
							</p>
						)}

						<div className="flex flex-col w-full">
							<label
								className="text-xs font-medium px-3 mb-0.5 text-headplane-700 dark:text-headplane-100"
								htmlFor="edit-host-note"
							>
								Note
							</label>
							<textarea
								className="rounded-xl px-3 py-2 min-h-[96px] resize-y focus:outline-hidden focus:ring-3 bg-white dark:bg-headplane-900 border border-headplane-100 dark:border-headplane-800"
								id="edit-host-note"
								onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
									setNote(event.target.value)
								}
								placeholder="Optional comments about this host. Stored as comments above the host entry in the JSON policy."
								value={note}
							/>
							<p className="text-xs px-3 mt-1 text-headplane-500 dark:text-headplane-400">
								Notes are stored as comments above each host entry in the JSON
								policy.
							</p>
						</div>
					</div>
				</div>
			</Dialog.Panel>
		</Dialog>
	);
}
