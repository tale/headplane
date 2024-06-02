import { useFetcher } from '@remix-run/react'
import { type Dispatch, type SetStateAction } from 'react'

import Dialog from '~/components/Dialog'
import Switch from '~/components/Switch'
import { type Machine, type Route } from '~/types'
import { cn } from '~/utils/cn'

interface RoutesProps {
	readonly machine: Machine
	readonly routes: Route[]
	readonly state: [boolean, Dispatch<SetStateAction<boolean>>]
}

// TODO: Support deleting routes
export default function Routes({ machine, routes, state }: RoutesProps) {
	const fetcher = useFetcher()

	return (
		<Dialog>
			<Dialog.Panel control={state}>
				{close => (
					<>
						<Dialog.Title>
							Edit route settings of
							{' '}
							{machine.givenName}
						</Dialog.Title>
						<Dialog.Text>
							Connect to devices you can&apos;t install Tailscale on
							by advertising IP ranges as subnet routes.
						</Dialog.Text>
						<div className={cn(
							'rounded-lg overflow-y-auto my-2',
							'divide-y divide-zinc-200 dark:divide-zinc-700 align-top',
							'border border-zinc-200 dark:border-zinc-700',
						)}
						>
							{routes.length === 0
								? (
									<div
										className={cn(
											'flex py-4 px-4 bg-ui-100 dark:bg-ui-800',
											'items-center justify-center',
											'text-ui-600 dark:text-ui-300',
										)}
									>
										<p>
											No routes are advertised on this machine.
										</p>
									</div>
									)
								: undefined}
							{routes.map(route => (
								<div
									key={route.node.id}
									className={cn(
										'flex py-2 px-4 bg-ui-100 dark:bg-ui-800',
										'items-center justify-between',
									)}
								>
									<p>
										{route.prefix}
									</p>
									<Switch
										defaultSelected={route.enabled}
										label="Enabled"
										onChange={(checked) => {
											const form = new FormData()
											form.set('id', machine.id)
											form.set('_method', 'routes')
											form.set('route', route.id)

											form.set('enabled', String(checked))
											fetcher.submit(form, {
												method: 'POST',
											})
										}}
									/>
								</div>
							))}
						</div>
						<div className="mt-6 flex justify-end gap-2 mt-6">
							<Dialog.Action
								variant="cancel"
								isDisabled={fetcher.state === 'submitting'}
								onPress={close}
							>
								Close
							</Dialog.Action>
						</div>
					</>
				)}
			</Dialog.Panel>
		</Dialog>
	)
}
