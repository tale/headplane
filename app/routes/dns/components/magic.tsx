import { useFetcher } from 'react-router';
import Dialog from '~/components/Dialog';
import Spinner from '~/components/Spinner';

type Properties = {
	readonly isEnabled: boolean;
	readonly disabled?: boolean;
};

// TODO: Use form action instead of JSON patching
// AND FIX JSON END OF UNEXPECTED INPUT
export default function Modal({ isEnabled, disabled }: Properties) {
	const fetcher = useFetcher();

	return (
		<Dialog>
			<Dialog.Button isDisabled={disabled}>
				{fetcher.state === 'idle' ? undefined : <Spinner className="w-3 h-3" />}
				{isEnabled ? 'Disable' : 'Enable'} Magic DNS
			</Dialog.Button>
			<Dialog.Panel
				onSubmit={() => {
					fetcher.submit(
						{
							'dns.magic_dns': !isEnabled,
						},
						{
							method: 'PATCH',
							encType: 'application/json',
						},
					);
				}}
			>
				<Dialog.Title>
					{isEnabled ? 'Disable' : 'Enable'} Magic DNS
				</Dialog.Title>
				<Dialog.Text>
					Devices will no longer be accessible via your tailnet domain. The
					search domain will also be disabled.
				</Dialog.Text>
			</Dialog.Panel>
		</Dialog>
	);
}
