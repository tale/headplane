import clsx from 'clsx'

import Button from '~/components/Button'

type FallbackProperties = {
	readonly acl: string;
	readonly where: 'client' | 'server';
}

export default function Fallback({ acl, where }: FallbackProperties) {
	return (
		<>
			<div className={clsx(
				where === 'server' ? 'mb-2 overflow-hidden rounded-tr-lg rounded-b-lg' : '',
				where === 'server' ? 'border border-gray-200 dark:border-gray-700' : ''
			)}
			>
				<textarea
					readOnly
					className={clsx(
						'w-full h-editor font-mono resize-none',
						'text-sm text-gray-600 dark:text-gray-300',
						'pl-10 pt-1 leading-snug'
					)}
					value={acl}
				/>
			</div>
			{where === 'server' ? (
				<>
					<Button
						variant='heavy'
						className='mr-2'
					>
						Save
					</Button>
					<Button>
						Discard Changes
					</Button>
				</>
			) : undefined}
		</>
	)
}
