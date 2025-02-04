import cn from '~/utils/cn';

export interface StatusCircleProps {
	isOnline: boolean;
	className?: string;
}

export default function StatusCircle({
	isOnline,
	className,
}: StatusCircleProps) {
	return (
		<svg
			className={cn(
				isOnline
					? 'text-green-600 dark:text-green-500'
					: 'text-headplane-200 dark:text-headplane-800',
				className,
			)}
			viewBox="0 0 24 24"
			fill="currentColor"
		>
			<title>{isOnline ? 'Online' : 'Offline'}</title>
			<circle cx="12" cy="12" r="8" />
		</svg>
	);
}
