import type { ReactNode } from 'react';
import {
	Button as AriaButton,
	Tooltip as AriaTooltip,
	TooltipTrigger,
} from 'react-aria-components';
import cn from '~/utils/cn';

interface Props {
	children: ReactNode;
	className?: string;
}

function Tooltip({ children }: Props) {
	return <TooltipTrigger delay={0}>{children}</TooltipTrigger>;
}

function Button(props: Parameters<typeof AriaButton>[0]) {
	return <AriaButton {...props} />;
}

function Body({ children, className }: Props) {
	return (
		<AriaTooltip
			className={cn(
				'text-sm max-w-xs p-2 rounded-lg mb-2',
				'bg-white dark:bg-ui-900 drop-shadow-sm',
				'border border-gray-200 dark:border-zinc-700',
				className,
			)}
		>
			{children}
		</AriaTooltip>
	);
}

export default Object.assign(Tooltip, { Button, Body });
