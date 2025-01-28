import cn from '~/utils/cn';

export interface ChipProps {
	text: string;
	className?: string;
}

export default function Chip({ text, className }: ChipProps) {
	return (
		<span
			className={cn(
				'text-xs px-2 py-0.5 rounded-full',
				'text-headplane-700 dark:text-headplane-100',
				'bg-headplane-100 dark:bg-headplane-700',
				className,
			)}
		>
			{text}
		</span>
	);
}
