import clsx from 'clsx';

interface Props {
	className?: string;
}

export default function Spinner({ className }: Props) {
	return (
		<div className={clsx('inline-block align-middle mb-0.5', className)}>
			<div
				className={clsx(
					'animate-spin rounded-full w-full h-full',
					'border-2 border-current border-t-transparent',
					className,
				)}
			>
				<span className="sr-only">Loading...</span>
			</div>
		</div>
	);
}
