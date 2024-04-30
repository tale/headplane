import { type FetcherWithComponents } from '@remix-run/react'
import { type Dispatch, type SetStateAction } from 'react'

import Dialog from '~/components/Dialog'
import { type Machine } from '~/types'
import { cn } from '~/utils/cn'

type DeleteProperties = {
	readonly machine: Machine;
	readonly fetcher: FetcherWithComponents<unknown>;
	readonly state: [boolean, Dispatch<SetStateAction<boolean>>];
}

export default function Delete({ machine, fetcher, state }: DeleteProperties) {
	return (
		<Dialog>
			<Dialog.Panel control={state}>
				{close => (
					<>
						<Dialog.Title>
							Remove {machine.givenName}
						</Dialog.Title>
						<Dialog.Text>
							This machine will be permanently removed from
							your network. To re-add it, you will need to
							reauthenticate to your tailnet from the device.
						</Dialog.Text>
						<fetcher.Form>
							<input type='hidden' name='_method' value='delete'/>
							<input type='hidden' name='id' value={machine.id}/>
							<div className='mt-6 flex justify-end gap-2 mt-6'>
								<Dialog.Action
									variant='cancel'
									onPress={close}
								>
									Cancel
								</Dialog.Action>
								<Dialog.Action
									variant='confirm'
									className={cn(
										'bg-red-500 hover:border-red-700',
										'pressed:bg-red-600'
									)}
									onPress={close}
								>
									Remove
								</Dialog.Action>
							</div>
						</fetcher.Form>
					</>
				)}
			</Dialog.Panel>
		</Dialog>
	)
}
