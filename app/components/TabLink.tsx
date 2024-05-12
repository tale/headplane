import { NavLink } from '@remix-run/react'
import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

type Properties = {
	readonly name: string;
	readonly to: string;
	readonly icon: ReactNode;
}

export default function TabLink({ name, to, icon }: Properties) {
	return (
		<NavLink
			to={to}
			prefetch='intent'
			className={({ isActive }) => cn(
				'border-b-2 py-1.5',
				isActive ? 'border-white' : 'border-transparent'
			)}
		>
			<div
				className={cn(
					'flex items-center gap-x-2 px-2.5 py-1.5 text-md text-nowrap',
					'hover:bg-ui-100/5 dark:hover:bg-ui-900/40 rounded-md'
				)}
			>
				{icon} {name}
			</div>
		</NavLink>
	)
}
