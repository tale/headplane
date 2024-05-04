import { InfoIcon } from '@primer/octicons-react'
import clsx from 'clsx'
import { type ReactNode } from 'react'

export default function Notice({ children }: { readonly children: ReactNode }) {
	return (
		<div className={clsx(
			'p-4 rounded-md w-fit flex items-center gap-3',
			'bg-slate-400 dark:bg-slate-700'
		)}
		>
			<InfoIcon className='h-6 w-6 text-white'/>
			{children}
		</div>
	)
}
