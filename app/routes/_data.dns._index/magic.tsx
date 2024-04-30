import { useFetcher } from '@remix-run/react'

import Button from '~/components/Button'
// TODO: Remove useModal and replace with Dialog
import useModal from '~/components/Modal'
import Spinner from '~/components/Spinner'

type Properties = {
	readonly isEnabled: boolean;
	// eslint-disable-next-line react/boolean-prop-naming
	readonly disabled?: boolean;
}

export default function Modal({ isEnabled, disabled }: Properties) {
	const fetcher = useFetcher()
	const { Modal, open } = useModal({
		title: `${isEnabled ? 'Disable' : 'Enable'} Magic DNS`,
		variant: isEnabled ? 'danger' : 'confirm',
		buttonText: `${isEnabled ? 'Disable' : 'Enable'} Magic DNS`,
		description: 'Devices will no longer be accessible via your tailnet domain. The search domain will also be disabled.',
		onConfirm: () => {
			fetcher.submit({
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'dns_config.magic_dns': !isEnabled
			}, {
				method: 'PATCH',
				encType: 'application/json'
			})
		}
	})

	return (
		<>
			<Button
				variant='emphasized'
				className='w-fit text-sm'
				disabled={disabled}
				onClick={() => {
					open()
				}}
			>
				{fetcher.state === 'idle' ? undefined : (
					<Spinner className='w-3 h-3'/>
				)}
				{isEnabled ? 'Disable' : 'Enable'} Magic DNS
			</Button>
			{Modal}
		</>
	)
}
