import React, { useRef } from 'react';
import {
	type AriaPopoverProps,
	DismissButton,
	Overlay,
	usePopover,
} from 'react-aria';
import type { OverlayTriggerState } from 'react-stately';
import cn from '~/utils/cn';

export interface PopoverProps extends Omit<AriaPopoverProps, 'popoverRef'> {
	children: React.ReactNode;
	state: OverlayTriggerState;
	popoverRef?: React.RefObject<HTMLDivElement | null>;
	className?: string;
}

export default function Popover(props: PopoverProps) {
	const ref = props.popoverRef ?? useRef<HTMLDivElement | null>(null);
	const { state, children, className } = props;
	const { popoverProps, underlayProps } = usePopover(
		{
			...props,
			popoverRef: ref,
			offset: 8,
		},
		state,
	);

	return (
		<Overlay>
			<div {...underlayProps} className="fixed inset-0" />
			<div
				{...popoverProps}
				ref={ref}
				className={cn(
					'z-10 shadow-xs rounded-xl',
					'bg-white dark:bg-headplane-900',
					'border border-headplane-200 dark:border-headplane-800',
					className,
				)}
			>
				<DismissButton onDismiss={state.close} />
				{children}
				<DismissButton onDismiss={state.close} />
			</div>
		</Overlay>
	);
}
