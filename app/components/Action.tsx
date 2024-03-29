import clsx from 'clsx'
import { type HTMLProps } from 'react'

type Properties = HTMLProps<HTMLButtonElement> & {
	readonly isDestructive?: boolean;
	readonly isDisabled?: boolean;
}

export default function Action(properties: Properties) {
	return (
		<button
			{...properties}
			type='button'
			className={clsx(
				properties.className,
				properties.isDisabled && 'opacity-50 cursor-not-allowed',
				properties.isDestructive
					? 'text-red-700 dark:text-red-500'
					: 'text-blue-700 dark:text-blue-400'
			)}
		>
			{properties.children}
		</button>
	)
}
