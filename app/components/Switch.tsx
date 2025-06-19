import { useRef } from 'react';
import {
	AriaSwitchProps,
	VisuallyHidden,
	useFocusRing,
	useSwitch,
} from 'react-aria';
import { useToggleState } from 'react-stately';
import cn from '~/utils/cn';

export interface SwitchProps extends AriaSwitchProps {
	label: string;
	className?: string;
}

export default function Switch(props: SwitchProps) {
	const state = useToggleState(props);
	const ref = useRef<HTMLInputElement | null>(null);
	const { focusProps, isFocusVisible } = useFocusRing();
	const { inputProps } = useSwitch(
		{
			...props,
			'aria-label': props.label,
		},
		state,
		ref,
	);

	return (
		<label className="flex items-center gap-x-2">
			<VisuallyHidden elementType="span">
				<input
					{...inputProps}
					{...focusProps}
					aria-label={props.label}
					ref={ref}
				/>
			</VisuallyHidden>
			<div
				aria-hidden
				className={cn(
					'flex h-[28px] w-[46px] p-[4px] shrink-0 rounded-full',
					'bg-headplane-300 dark:bg-headplane-700',
					'border border-transparent dark:border-headplane-800',
					state.isSelected && 'bg-headplane-900 dark:bg-headplane-950',
					isFocusVisible && 'ring-2',
					props.isDisabled && 'opacity-50',
				)}
			>
				<span
					className={cn(
						'h-[18px] w-[18px] transform rounded-full',
						'bg-white transition duration-50 ease-in-out',
						'translate-x-0 group-selected:translate-x-full',
						state.isSelected && 'translate-x-full',
					)}
				/>
			</div>
		</label>
	);
}
