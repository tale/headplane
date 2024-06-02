import { KebabHorizontalIcon } from '@primer/octicons-react'
import { useState } from 'react'

import MenuComponent from '~/components/Menu'
import { Machine, Route } from '~/types'
import { cn } from '~/utils/cn'

import Delete from './dialogs/delete'
import Expire from './dialogs/expire'
import Rename from './dialogs/rename'
import Routes from './dialogs/routes'

interface MenuProps {
	machine: Machine
	routes: Route[]
	magic?: string
}

export default function Menu({ machine, routes, magic }: MenuProps) {
	const renameState = useState(false)
	const expireState = useState(false)
	const removeState = useState(false)
	const routesState = useState(false)

	const expired = machine.expiry === '0001-01-01 00:00:00'
		? false
		: new Date(machine.expiry).getTime() < Date.now()

	return (
		<>
			<Rename
				machine={machine}
				state={renameState}
				magic={magic}
			/>
			<Delete
				machine={machine}
				state={removeState}
			/>
			{expired
				? undefined
				: (
					<Expire
						machine={machine}
						state={expireState}
					/>
					)}
			<Routes
				machine={machine}
				routes={routes}
				state={routesState}
			/>

			<MenuComponent>
				<MenuComponent.Button
					className={cn(
						'flex items-center justify-center',
						'border border-transparent rounded-lg py-0.5 w-10',
						'group-hover:border-gray-200 dark:group-hover:border-zinc-700',
					)}
				>
					<KebabHorizontalIcon className="w-5" />
				</MenuComponent.Button>
				<MenuComponent.Items>
					<MenuComponent.ItemButton control={renameState}>
						Edit machine name
					</MenuComponent.ItemButton>
					<MenuComponent.ItemButton control={routesState}>
						Edit route settings
					</MenuComponent.ItemButton>
					<MenuComponent.Item className="opacity-50 hover:bg-transparent">
						Edit ACL tags
					</MenuComponent.Item>
					{expired
						? undefined
						: (
							<MenuComponent.ItemButton control={expireState}>
								Expire
							</MenuComponent.ItemButton>
							)}
					<MenuComponent.ItemButton
						className="text-red-500 dark:text-red-400"
						control={removeState}
					>
						Remove
					</MenuComponent.ItemButton>
				</MenuComponent.Items>
			</MenuComponent>
		</>
	)
}
