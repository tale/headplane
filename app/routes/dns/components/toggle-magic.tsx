import Dialog from '~/components/Dialog';

interface Props {
	isEnabled: boolean;
	isDisabled: boolean;
}

export default function Modal({ isEnabled, isDisabled }: Props) {
	return (
		<Dialog>
			<Dialog.Button isDisabled={isDisabled}>
				{isEnabled ? 'Disable' : 'Enable'} Magic DNS
			</Dialog.Button>
			<Dialog.Panel isDisabled={isDisabled}>
				<Dialog.Title>
					{isEnabled ? 'Disable' : 'Enable'} Magic DNS
				</Dialog.Title>
				<Dialog.Text>
					Devices will no longer be accessible via your tailnet domain. The
					search domain will also be disabled.
				</Dialog.Text>
				<input type="hidden" name="action_id" value="toggle_magic" />
				<input
					type="hidden"
					name="new_state"
					value={isEnabled ? 'disabled' : 'enabled'}
				/>
			</Dialog.Panel>
		</Dialog>
	);
}
