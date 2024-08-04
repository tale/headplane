import { InfoIcon } from '@primer/octicons-react'
import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

interface Props {
	className?: string
	children: ReactNode
}

export default function Notice({ children, className }: Props) {
	return (
		<div className={cn(
			'p-4 rounded-md w-full flex items-center gap-3',
			'bg-ui-200 dark:bg-ui-800',
			className,
		)}
		>
			<InfoIcon className="h-6 w-6 text-ui-700 dark:text-ui-200" />
			{children}
		</div>
	)
}
