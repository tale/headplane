import { NavLink } from '@remix-run/react'
import clsx from 'clsx'
import type { ReactNode } from 'react'

type Properties = {
	readonly name: string;
	readonly to: string;
	readonly icon: ReactNode;
}

export default function TabLink({ name, to, icon }: Properties) {
	return (
		<NavLink
			to={to}
			className={({ isActive, isPending }) => clsx(
				'flex items-center gap-x-2 p-2 border-b-2 text-md',
				isActive ? 'border-white' : 'border-transparent'
			)}
		>
			{icon} {name}
		</NavLink>
	)
}
