import { useFetcher } from '@remix-run/react'

import Dialog from '~/components/Dialog'
import Spinner from '~/components/Spinner'
import { cn } from '~/utils/cn'

type Properties = {
	readonly isEnabled: boolean;
	// eslint-disable-next-line react/boolean-prop-naming
	readonly disabled?: boolean;
}

export default function Modal({ isEnabled, disabled }: Properties) {
	const fetcher = useFetcher()

	return (
		<Dialog>
			<Dialog.Button
				isDisabled={disabled}
				className={cn(
					'w-fit text-sm rounded-lg px-4 py-2',
					'bg-gray-700 dark:bg-gray-800 text-white',
					disabled && 'opacity-50 cursor-not-allowed'
				)}
			>
				{fetcher.state === 'idle' ? undefined : (
					<Spinner className='w-3 h-3'/>
				)}
				{isEnabled ? 'Disable' : 'Enable'} Magic DNS
			</Dialog.Button>
			<Dialog.Panel>
				{close => (
					<>
						<Dialog.Title>
							{isEnabled ? 'Disable' : 'Enable'} Magic DNS
						</Dialog.Title>
						<Dialog.Text>
							Devices will no longer be accessible via your tailnet domain.
							The search domain will also be disabled.
						</Dialog.Text>
						<div className='mt-6 flex justify-end gap-2 mt-6'>
							<Dialog.Action
								variant='cancel'
								onPress={close}
							>
								Cancel
							</Dialog.Action>
							<Dialog.Action
								variant='confirm'
								onPress={() => {
									fetcher.submit({
										// eslint-disable-next-line @typescript-eslint/naming-convention
										'dns_config.magic_dns': !isEnabled
									}, {
										method: 'PATCH',
										encType: 'application/json'
									})

									close()
								}}
							>
								{isEnabled ? 'Disable' : 'Enable'} Magic DNS
							</Dialog.Action>
						</div>
					</>
				)}
			</Dialog.Panel>
		</Dialog>
	)
}
