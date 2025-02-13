import Code from '~/components/Code';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';

interface Props {
	name: string;
	isDisabled: boolean;
}

export default function RenameTailnet({ name, isDisabled }: Props) {
	return (
		<div className="flex flex-col w-2/3 gap-y-4">
			<h1 className="text-2xl font-medium mb-2">Tailnet Name</h1>
			<p>
				This is the base domain name of your Tailnet. Devices are accessible at{' '}
				<Code>[device].{name}</Code> when Magic DNS is enabled.
			</p>
			<Input
				isReadOnly
				labelHidden
				className="w-3/5 font-medium text-sm"
				label="Tailnet name"
				value={name}
				onFocus={(event) => {
					event.target.select();
				}}
			/>
			<Dialog>
				<Dialog.Button isDisabled={isDisabled}>Rename Tailnet</Dialog.Button>
				<Dialog.Panel isDisabled={isDisabled}>
					<Dialog.Title>Rename Tailnet</Dialog.Title>
					<Dialog.Text className="mb-8">
						Keep in mind that changing this can lead to all sorts of unexpected
						behavior and may break existing devices in your tailnet.
					</Dialog.Text>
					<input type="hidden" name="action_id" value="rename_tailnet" />
					<Input
						isRequired
						label="Tailnet name"
						placeholder="ts.net"
						defaultValue={name}
						name="new_name"
					/>
				</Dialog.Panel>
			</Dialog>
		</div>
	);
}
