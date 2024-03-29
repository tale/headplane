import clsx from 'clsx'
import { type DetailedHTMLProps, type InputHTMLAttributes } from 'react'

type Properties = {
	readonly isEmbedded?: boolean;
} & DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>

export default function Input(properties: Properties) {
	return (
		<input
			{...properties}
			className={clsx(
				'block w-full dark:text-gray-300',
				'border-gray-300 dark:border-zinc-700',
				'focus:outline-none focus:ring',
				'focus:ring-blue-500 dark:focus:ring-blue-300',
				properties.isEmbedded ? 'bg-transparent' : 'dark:bg-zinc-800',
				properties.isEmbedded ? 'p-0' : 'px-2.5 py-1.5',
				properties.isEmbedded ? 'border-none' : 'border',
				properties.isEmbedded ? 'focus:ring-0' : 'focus:ring-1',
				properties.isEmbedded ? 'rounded-none' : 'rounded-lg',
				properties.className
			)}
		/>
	)
}
