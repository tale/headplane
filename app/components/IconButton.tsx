import React, { useRef } from 'react';
import { type AriaButtonOptions, useButton } from 'react-aria';
import cn from '~/utils/cn';

export interface IconButtonProps extends AriaButtonOptions<'button'> {
	variant?: 'heavy' | 'light';
	className?: string;
	children: React.ReactNode;
	label: string;
	ref?: React.RefObject<HTMLButtonElement | null>;
}

export default function IconButton({
	variant = 'light',
	...props
}: IconButtonProps) {
	// In case the button is used as a trigger ref
	const ref = props.ref ?? useRef<HTMLButtonElement | null>(null);
	const { buttonProps } = useButton(props, ref);

	return (
		<button
			ref={ref}
			{...buttonProps}
			aria-label={props.label}
			className={cn(
				'rounded-full flex items-center justify-center p-1',
				'focus:outline-hidden focus:ring-3',
				props.isDisabled && 'opacity-60 cursor-not-allowed',
				...(variant === 'heavy'
					? [
							'bg-headplane-900 dark:bg-headplane-50 font-semibold',
							'hover:bg-headplane-900/90 dark:hover:bg-headplane-50/90',
							'text-headplane-200 dark:text-headplane-800',
						]
					: [
							'bg-headplane-100 dark:bg-headplane-700/30 font-medium',
							'hover:bg-headplane-200/90 dark:hover:bg-headplane-800/30',
						]),
				props.className,
			)}
		>
			{props.children}
		</button>
	);
}
