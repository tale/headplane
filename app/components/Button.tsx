import React, { useRef } from 'react';
import { type AriaButtonOptions, useButton } from 'react-aria';
import cn from '~/utils/cn';

export interface ButtonProps extends AriaButtonOptions<'button'> {
	variant?: 'heavy' | 'light' | 'danger';
	className?: string;
	children?: React.ReactNode;
	ref?: React.RefObject<HTMLButtonElement | null>;
}

export default function Button({ variant = 'light', ...props }: ButtonProps) {
	// In case the button is used as a trigger ref
	const ref = props.ref ?? useRef<HTMLButtonElement | null>(null);
	const { buttonProps } = useButton(props, ref);

	return (
		<button
			ref={ref}
			{...buttonProps}
			className={cn(
				'w-fit text-sm rounded-xl px-3 py-2',
				'focus:outline-hidden focus:ring-3',
				props.isDisabled && 'opacity-60 cursor-not-allowed',
				...(variant === 'heavy'
					? [
							'bg-headplane-900 dark:bg-headplane-50 font-semibold',
							'hover:bg-headplane-900/90 dark:hover:bg-headplane-50/90',
							'text-headplane-200 dark:text-headplane-800',
						]
					: variant === 'danger'
						? ['bg-red-500 text-white font-semibold', 'hover:bg-red-500/90']
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
