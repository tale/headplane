import clsx from 'clsx'

type Properties = {
	// eslint-disable-next-line unicorn/no-keyword-prefix
	className?: string;
}

export default function Spinner(properties: Properties) {
	return (
		<div className={clsx('mr-1.5 inline-block align-middle mb-0.5', properties.className)}>
			<div
				className={clsx(
					'animate-spin rounded-full w-full h-full',
					'border-2 border-current border-t-transparent',
					properties.className
				)}
				role='status'
			>
				<span className='sr-only'>Loading...</span>
			</div>
		</div>
	)
}
