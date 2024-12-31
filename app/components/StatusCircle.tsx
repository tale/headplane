import clsx from 'clsx';
import type { HTMLProps } from 'react';

type Props = HTMLProps<SVGElement> & {
	readonly isOnline: boolean;
};

// eslint-disable-next-line unicorn/no-keyword-prefix
export default function StatusCircle({ isOnline, className }: Props) {
	return (
		<svg
			className={clsx(
				className,
				isOnline
					? 'text-green-700 dark:text-green-400'
					: 'text-gray-300 dark:text-gray-500',
			)}
			viewBox="0 0 24 24"
			fill="currentColor"
		>
			<circle cx="12" cy="12" r="8" />
		</svg>
	);
}
