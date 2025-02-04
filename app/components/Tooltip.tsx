import React, { cloneElement, useRef } from 'react';
import {
	AriaTooltipProps,
	mergeProps,
	useTooltip,
	useTooltipTrigger,
} from 'react-aria';
import { TooltipTriggerState, useTooltipTriggerState } from 'react-stately';
import cn from '~/utils/cn';

export interface TooltipProps extends AriaTooltipProps {
	children: [React.ReactElement, React.ReactElement<TooltipBodyProps>];
}

// TODO: Fix Button accessibility outline + invoke
function Tooltip(props: TooltipProps) {
	const state = useTooltipTriggerState({
		...props,
		delay: 0,
		closeDelay: 0,
	});

	const ref = useRef<HTMLButtonElement | null>(null);
	const { triggerProps, tooltipProps } = useTooltipTrigger(
		{
			...props,
			delay: 0,
			closeDelay: 0,
		},
		state,
		ref,
	);

	const [component, body] = props.children;
	return (
		<span className="relative">
			<button
				ref={ref}
				{...triggerProps}
				className="flex items-center justify-center"
			>
				{component}
			</button>
			{state.isOpen &&
				cloneElement(body, {
					...tooltipProps,
					state,
				})}
		</span>
	);
}

interface TooltipBodyProps extends AriaTooltipProps {
	children: React.ReactNode;
	state?: TooltipTriggerState;
	className?: string;
}

function Body({ state, className, ...props }: TooltipBodyProps) {
	const { tooltipProps } = useTooltip(props, state);
	return (
		<span
			{...mergeProps(props, tooltipProps)}
			className={cn(
				'absolute z-50 p-3 top-full mt-1',
				'outline-none rounded-3xl text-sm w-48',
				'bg-white dark:bg-headplane-950',
				'text-black dark:text-white',
				'shadow-lg dark:shadow-md rounded-xl',
				'border border-headplane-100 dark:border-headplane-800',
				className,
			)}
		>
			{props.children}
		</span>
	);
}

export default Object.assign(Tooltip, {
	Body,
});
