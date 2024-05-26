import { LinkExternalIcon } from '@primer/octicons-react'

import { cn } from '~/utils/cn'

interface Props {
	to: string
	name: string
	children: string
	className?: string
}

export default function Link({ to, name: alt, children, className }: Props) {
	return (
		<a
			href={to}
			aria-label={alt}
			target="_blank"
			rel="noreferrer"
			className={cn(
				'inline-flex items-center gap-x-1',
				'text-blue-500 hover:text-blue-700',
				'dark:text-blue-400 dark:hover:text-blue-300',
				className,
			)}
		>
			{children}
			<LinkExternalIcon className="h-3 w-3" />
		</a>
	)
}
