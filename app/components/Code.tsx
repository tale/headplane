import { type ReactNode } from 'react'

export default function Code({ children }: { readonly children: ReactNode }) {
	return (
		<code className='bg-gray-100 dark:bg-zinc-700 p-0.5 rounded-md'>
			{children}
		</code>
	)
}
