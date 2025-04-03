import React, { createContext, useContext, useRef } from 'react';
import {
	AriaRadioGroupProps,
	AriaRadioProps,
	VisuallyHidden,
	useFocusRing,
} from 'react-aria';
import { RadioGroupState } from 'react-stately';
import cn from '~/utils/cn';

import { useRadio, useRadioGroup } from 'react-aria';
import { useRadioGroupState } from 'react-stately';

interface RadioGroupProps extends AriaRadioGroupProps {
	children: React.ReactElement<RadioProps>[];
	label: string;
	className?: string;
}

const RadioContext = createContext<RadioGroupState | null>(null);

function RadioGroup({ children, label, className, ...props }: RadioGroupProps) {
	const state = useRadioGroupState(props);
	const { radioGroupProps, labelProps } = useRadioGroup(
		{
			...props,
			'aria-label': label,
		},
		state,
	);

	return (
		<div {...radioGroupProps} className={cn('flex flex-col gap-2', className)}>
			<VisuallyHidden>
				<span {...labelProps}>{label}</span>
			</VisuallyHidden>
			<RadioContext.Provider value={state}>{children}</RadioContext.Provider>
		</div>
	);
}

interface RadioProps extends AriaRadioProps {
	label: string;
	className?: string;
}

function Radio({ children, label, className, ...props }: RadioProps) {
	const state = useContext(RadioContext);
	const ref = useRef(null);
	const { inputProps, isSelected, isDisabled } = useRadio(
		{
			...props,
			'aria-label': label,
		},
		state!,
		ref,
	);
	const { isFocusVisible, focusProps } = useFocusRing();

	return (
		<label className="flex items-center gap-2 text-sm">
			<VisuallyHidden>
				<input {...inputProps} {...focusProps} ref={ref} className="peer" />
			</VisuallyHidden>
			<div
				aria-hidden="true"
				className={cn(
					'w-5 h-5 aspect-square rounded-full p-1 border-2',
					'border border-headplane-600 dark:border-headplane-300',
					isFocusVisible ? 'ring-4' : '',
					isDisabled ? 'opacity-50 cursor-not-allowed' : '',
					isSelected
						? 'border-[6px] border-headplane-900 dark:border-headplane-100'
						: '',
					className,
				)}
			/>
			{children}
		</label>
	);
}

export default Object.assign(RadioGroup, { Radio });
