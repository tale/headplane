import { useProgressBar } from 'react-aria';
import cn from '~/utils/cn';

export interface ProgressBarProps {
	isVisible: boolean;
}

export default function ProgressBar(props: ProgressBarProps) {
	const { isVisible } = props;
	const { progressBarProps } = useProgressBar({
		label: 'Loading...',
		isIndeterminate: true,
	});

	return (
		<div
			{...progressBarProps}
			aria-hidden={!isVisible}
			className={cn(
				'fixed top-0 left-0 z-50 w-1/2 h-1 opacity-0',
				'bg-headplane-950 dark:bg-headplane-50',
				isVisible && 'animate-loading opacity-100',
			)}
		/>
	);
}
