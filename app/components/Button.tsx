import clsx from 'clsx'
import { type ButtonHTMLAttributes, type DetailedHTMLProps } from 'react'

type Properties = {
	readonly variant?: 'emphasized' | 'normal' | 'destructive';
} & DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>

export default function Action(properties: Properties) {
	return (
		<button
			type='button'
			{...properties}
			className={clsx(
				'focus:outline-none focus:ring focus:ring-1',
				'focus:ring-blue-500 dark:focus:ring-blue-300',
				properties.className,
				properties.disabled && 'opacity-50 cursor-not-allowed',
				properties.variant === 'destructive' ? 'text-red-700 dark:text-red-500' : '',
				properties.variant === 'emphasized' ? 'rounded-lg px-4 py-2 bg-gray-800 dark:bg-gray-700 text-white' : '',
				!properties.variant || properties.variant === 'normal' ? 'text-blue-700 dark:text-blue-400' : ''
			)}
		>
			{properties.children}
		</button>
	)
}
