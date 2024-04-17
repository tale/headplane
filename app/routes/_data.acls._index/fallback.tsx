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
						disabled
						variant='emphasized'
						className='text-sm w-fit mr-2'
					>
						Save
					</Button>
					<Button
						disabled
						variant='emphasized'
						className={clsx(
							'text-sm w-fit bg-gray-100 dark:bg-transparent',
							'border border-gray-200 dark:border-gray-700'
						)}
					>
						Discard Changes
					</Button>
				</>
			) : undefined}
		</>
	)
}
